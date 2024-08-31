// Updated code with Google Maps tile layers
frappe.pages['maps'] = {
    onload: function(wrapper) {
        const page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Vehicle Tracking',
            single_column: true
        });

        $(wrapper).find('.layout-main-section').css({
            'display': 'flex',
            'height': 'calc(100vh - 60px)',
            'margin': '0',
            'padding': '0'
        });

        $(wrapper).find('.layout-main-section').append(`
            <div id="sidebar" style="
                width: 300px; 
                background-color: #f8f9fa;
                padding: 20px;
                border-right: 2px solid #e0e0e0;
                box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
                overflow-y: auto;">
                <h3 style="margin-bottom: 15px;">Vehicle Tracker</h3>
                <input type="text" id="search-input" placeholder="Search vehicle..." style="
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 15px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-sizing: border-box;">
                <div id="filters" style="margin-bottom: 15px;">
                    <select id="status-filter" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="all">All Statuses</option>
                        <option value="moving">Moving</option>
                        <option value="stopped">Stopped</option>
                        <option value="idle">Idle</option>
                    </select>
                </div>
                <ul id="vehicle-list" style="list-style-type: none; padding: 0;"></ul>
                <p id="no-results" style="display:none; color: red;">No results found.</p>
            </div>
        `);

        $(wrapper).find('.layout-main-section').append('<div id="mapid" style="flex-grow: 1; height: 100%;"></div>');

        // Load Leaflet and other assets
        frappe.require([
            'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
            'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js'
        ], function() {
            // Initialize the map centered on a default location (Kenya)
            const map = L.map('mapid').setView([-1.286389, 36.817223], 7);

            // Define the Google Maps tile layers
            const googleRoadmapLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
                attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
            });
            const googleSatelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
                attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
            });
            const googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
                attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
            });
            const googleTerrainLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
                attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
            });

            // Add the default layer to the map
            googleRoadmapLayer.addTo(map);

            // Add layer control for switching between map types
            L.control.layers({
                'Roadmap': googleRoadmapLayer,
                'Satellite': googleSatelliteLayer,
                'Hybrid': googleHybridLayer,
                'Terrain': googleTerrainLayer
            }).addTo(map);

            // Custom icons for vehicle statuses
            const icons = {
                moving: L.icon({
                    iconUrl: '/files/car-moving.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                }),
                stopped: L.icon({
                    iconUrl: '/files/car-stopped.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                }),
                idle: L.icon({
                    iconUrl: '/files/car-idle.png',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16],
                })
            };

            const markers = {};
            const vehicles = {};

            // Fetch vehicle data
            function updateVehicleData() {
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'GPS Log',
                        fields: ['name', 'latitude', 'longitude', 'device_id', 'speed', 'heading', 'altitude', 'recieved_at'],
                        order_by: 'device_id asc, modified desc',
                        filters: [
                            ['latitude', '!=', null],
                            ['longitude', '!=', null]
                        ],
                        limit_page_length: 1000
                    },
                    callback: function(response) {
                        const locations = response.message;
                        const latestLocations = {};

                        locations.forEach(function(location) {
                            if (!latestLocations[location.device_id] || new Date(location.recieved_at) > new Date(latestLocations[location.device_id].recieved_at)) {
                                latestLocations[location.device_id] = location;
                            }
                        });

                        Object.keys(latestLocations).forEach(function(device_id) {
                            updateVehicleMarker(latestLocations[device_id]);
                        });

                        updateVehicleList();
                    }
                });
            }

            // Update markers based on vehicle data
            function updateVehicleMarker(location) {
                const status = getVehicleStatus(location.speed);
                const icon = icons[status];

                if (markers[location.device_id]) {
                    markers[location.device_id].setLatLng([location.latitude, location.longitude]);
                    markers[location.device_id].setIcon(icon);
                } else {
                    markers[location.device_id] = L.marker([location.latitude, location.longitude], { icon: icon }).addTo(map);
                }

                markers[location.device_id].bindPopup(createPopupContent(location));

                vehicles[location.device_id] = {
                    id: location.device_id,
                    status: status,
                    speed: location.speed,
                    lastUpdate: location.recieved_at
                };
            }

            // Determine vehicle status based on speed
            function getVehicleStatus(speed) {
                if (speed > 5) return 'moving';
                if (speed > 0) return 'idle';
                return 'stopped';
            }

            // Create HTML content for the marker popup
            function createPopupContent(location) {
                return `
                    <strong>Vehicle ID:</strong> ${location.device_id}<br>
                    <strong>Speed:</strong> ${location.speed} km/h<br>
                    <strong>Heading:</strong> ${location.heading}°<br>
                                        <strong>Altitude:</strong> ${location.altitude} m<br>
                    <strong>Last Update:</strong> ${location.recieved_at}
                `;
            }

            // Update the sidebar vehicle list
            function updateVehicleList() {
                const $list = $('#vehicle-list');
                $list.empty();

                Object.values(vehicles).forEach(function(vehicle) {
                    $list.append(`
                        <li class="vehicle-item" data-id="${vehicle.id}" data-status="${vehicle.status}" style="cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #e0e0e0;">
                                <span>${vehicle.id}</span>
                                <span class="status-indicator ${vehicle.status}">${vehicle.status}</span>
                            </div>
                            <div style="padding: 5px 10px; font-size: 0.9em;">
                                <div>Speed: ${vehicle.speed} km/h</div>
                                <div>Last Update: ${vehicle.lastUpdate}</div>
                            </div>
                        </li>
                    `);
                });

                // Center map on vehicle when clicked
                $('.vehicle-item').on('click', function() {
                    const deviceId = $(this).data('id');
                    if (markers[deviceId]) {
                        map.setView(markers[deviceId].getLatLng(), 15);
                        markers[deviceId].openPopup();
                    }
                });
            }

            // Event listeners for search and filter
            $('#search-input').on('input', function() {
                const query = $(this).val().toLowerCase();
                $('.vehicle-item').each(function() {
                    const deviceId = $(this).data('id').toLowerCase();
                    $(this).toggle(deviceId.includes(query));
                });
                $('#no-results').toggle($('.vehicle-item:visible').length === 0);
            });

            $('#status-filter').on('change', function() {
                const status = $(this).val();
                if (status === 'all') {
                    $('.vehicle-item').show();
                } else {
                    $('.vehicle-item').each(function() {
                        $(this).toggle($(this).data('status') === status);
                    });
                }
                $('#no-results').toggle($('.vehicle-item:visible').length === 0);
            });

            // Load data and set interval for refreshing
            updateVehicleData();
            setInterval(updateVehicleData, 60000);

            // Additional custom styles
            $('<style>')
                .prop('type', 'text/css')
                .html(`
                    .status-indicator {
                        padding: 2px 6px;
                        border-radius: 12px;
                        font-size: 0.8em;
                        font-weight: bold;
                    }
                    .status-indicator.moving { background-color: #4CAF50; color: white; }
                    .status-indicator.stopped { background-color: #F44336; color: white; }
                    .status-indicator.idle { background-color: #FFC107; color: black; }
                    .vehicle-item:hover { background-color: #e0f7fa; }
                `)
                .appendTo('head');
        });
    }
};

