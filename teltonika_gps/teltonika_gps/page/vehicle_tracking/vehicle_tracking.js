frappe.pages['vehicle-tracking'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Vehicle Tracking',
        single_column: true
    });

    // Improved CSS for a more modern look
    frappe.dom.set_style(`
        .vehicle-tracking-container {
            display: flex;
            height: calc(100vh - 60px);
            width: 100%;
            background-color: var(--bg-color);
            color: var(--text-color);
        }
        .sidebar {
            width: 300px;
            padding: 15px;
            background-color: var(--card-bg);
            border-right: 1px solid var(--border-color);
            overflow-y: auto;
            transition: width 0.3s ease;
            flex-shrink: 0;
        }
        .main-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .toolbar {
            padding: 10px;
            background-color: var(--card-bg);
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid var(--border-color);
        }
        #map-container, #list-container {
            flex-grow: 1;
            position: relative;
            background-color: var(--bg-color);
        }
        .loading-spinner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border: 4px solid var(--bg-color);
            border-top-color: var(--primary-color);
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            display: none;
        }
        @keyframes spin {
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .vehicle-item {
            cursor: pointer;
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
            transition: background-color 0.2s ease;
        }
        .vehicle-item:hover {
            background-color: var(--fg-hover-color);
        }
        .vehicle-item.active {
            background-color: var(--fg-color);
        }
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
        }
        .status-badge.moving { background-color: #28a745; color: white; }
        .status-badge.idle { background-color: #ffc107; color: black; }
        .status-badge.stopped { background-color: #dc3545; color: white; }
    `);

    // React-like component for the main application structure
    const VehicleTrackingApp = {
        render: function() {
            return `
                <div class="vehicle-tracking-container">
                    ${this.renderSidebar()}
                    ${this.renderMainContent()}
                </div>
            `;
        },

        renderSidebar: function() {
            return `
                <div class="sidebar">
                    <h3>Vehicle List</h3>
                    ${this.renderFilters()}
                    <div id="vehicle-list"></div>
                </div>
            `;
        },

        renderFilters: function() {
            return `
                <div class="filters mb-3">
                    <input type="text" class="form-control mb-2" id="search-input" placeholder="Search vehicles...">
                    <select class="form-control mb-2" id="status-filter">
                        <option value="all">All Status</option>
                        <option value="moving">Moving</option>
                        <option value="idle">Idle</option>
                        <option value="stopped">Stopped</option>
                    </select>
                    <select class="form-control" id="time-range">
                        <option value="all">All Time</option>
                        <option value="1h">Last Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                    </select>
                </div>
            `;
        },

        renderMainContent: function() {
            return `
                <div class="main-content">
                    ${this.renderToolbar()}
                    <div id="map-container">
                        <div class="loading-spinner" id="loading-spinner"></div>
                    </div>
                    <div id="list-container" class="d-none">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Vehicle</th>
                                    <th>Status</th>
                                    <th>Speed</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="vehicle-table-body"></tbody>
                        </table>
                    </div>
                </div>
            `;
        },

        renderToolbar: function() {
            return `
                <div class="toolbar">
                    <div class="btn-group" role="group">
                        <button class="btn btn-secondary btn-sm" id="zoom-in"><i class="fa fa-search-plus"></i></button>
                        <button class="btn btn-secondary btn-sm" id="zoom-out"><i class="fa fa-search-minus"></i></button>
                        <button class="btn btn-secondary btn-sm" id="refresh-data"><i class="fa fa-sync"></i></button>
                    </div>
                    <div class="btn-group" role="group">
                        <button class="btn btn-primary btn-sm active" id="map-view"><i class="fa fa-map"></i> Map View</button>
                        <button class="btn btn-primary btn-sm" id="list-view"><i class="fa fa-list"></i> List View</button>
                    </div>
                    <div class="btn-group" role="group">
                        <button class="btn btn-info btn-sm active" id="roadmap-view">Roadmap</button>
                        <button class="btn btn-info btn-sm" id="satellite-view">Satellite</button>
                        <button class="btn btn-info btn-sm" id="hybrid-view">Hybrid</button>
                        <button class="btn btn-info btn-sm" id="terrain-view">Terrain</button>
                    </div>
                    <div class="theme-switcher">
                        <button class="btn btn-outline-secondary btn-sm" id="toggle-theme">
                            <i class="fa fa-moon"></i> Toggle Theme
                        </button>
                    </div>
                </div>
            `;
        }
    };

    // Render the main application structure
    $(wrapper).find('.layout-main-section').html(VehicleTrackingApp.render());

    let map, markers = {}, vehicleData = {}, routeLayer, statisticsControl;

    // Initialize Google Maps
    function initializeMap() {
        const mapContainer = document.getElementById('map-container');
        map = new google.maps.Map(mapContainer, {
            center: { lat: -1.286389, lng: 36.817223 },
            zoom: 7,
            styles: getMapStyles()
        });

        // Add custom controls
        addCustomControls();

        // Initial data load
        updateTrackingData();
        setInterval(updateTrackingData, 30000);
    }

    // Fetch GPS logs using Frappe API
    function fetchLatestGPSLogs(timeRange = 'all') {
        toggleLoading(true);
        let filters = [
            ['latitude', '!=', null],
            ['longitude', '!=', null]
        ];

        if (timeRange !== 'all') {
            let now = frappe.datetime.now_datetime();
            let timeDelta;
            switch (timeRange) {
                case '1h':
                    timeDelta = frappe.datetime.add_to_date(now, { hours: -1 });
                    break;
                case '24h':
                    timeDelta = frappe.datetime.add_to_date(now, { days: -1 });
                    break;
                case '7d':
                    timeDelta = frappe.datetime.add_to_date(now, { days: -7 });
                    break;
            }
            filters.push(['recieved_at', '>=', timeDelta]);
        }

        return frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'GPS Log',
                fields: ['name', 'latitude', 'longitude', 'device_id', 'vehicle', 'modified', 'recieved_at', 'speed', 'heading'],
                filters: filters,
                order_by: 'vehicle asc, modified desc, recieved_at desc',
                limit_page_length: 1000
            }
        }).then(r => {
            toggleLoading(false);
            return r.message;
        }).catch(err => {
            toggleLoading(false);
            handleFetchError(err);
        });
    }

    function updateTrackingData(timeRange = 'all') {
        fetchLatestGPSLogs(timeRange).then(logs => {
            if (logs) {
                updateVehicleList(logs);
                updateMarkers(logs);
                updateStatistics();
            }
        });
    }

    function updateVehicleList(logs) {
        vehicleData = {};
        let vehicleListHTML = logs.map(log => {
            vehicleData[log.device_id] = log;
            return `
                <div class="vehicle-item" data-device-id="${log.device_id}">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-1">${log.vehicle || `Device ${log.device_id}`}</h5>
                        ${getStatusBadge(log.speed)}
                    </div>
                    <p class="mb-1">Speed: ${log.speed} km/h</p>
                    <small>Last updated: ${log.recieved_at}</small>
                </div>
            `;
        }).join('');
        $('#vehicle-list').html(vehicleListHTML);
        updateListView(logs);
    }

    function getStatusBadge(speed) {
        if (speed > 5) return '<span class="status-badge moving">Moving</span>';
        if (speed > 0) return '<span class="status-badge idle">Idle</span>';
        return '<span class="status-badge stopped">Stopped</span>';
    }

    function updateMarkers(logs) {
        let bounds = new google.maps.LatLngBounds();

        logs.forEach(log => {
            let position = new google.maps.LatLng(log.latitude, log.longitude);
            let markerIcon = {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: getStatusColor(log.speed),
                fillOpacity: 0.8,
                scale: 8,
                strokeColor: 'white',
                strokeWeight: 2
            };

            if (markers[log.device_id]) {
                markers[log.device_id].setPosition(position);
                markers[log.device_id].setIcon(markerIcon);
            } else {
                let marker = new google.maps.Marker({
                    position: position,
                    map: map,
                    icon: markerIcon
                });

                markers[log.device_id] = marker;

                let infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="info-window">
                            <h3>${log.vehicle || `Device ${log.device_id}`}</h3>
                            <p>Status: ${getStatusBadge(log.speed)}</p>
                            <p>Speed: ${log.speed} km/h</p>
                            <p>Heading: ${log.heading}°</p>
                            <p>Last Updated: ${log.recieved_at}</p>
                            <button class="btn btn-sm btn-primary trace-route" data-device-id="${log.device_id}">Trace Route</button>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });
            }

            bounds.extend(position);
        });

        map.fitBounds(bounds);
    }

    function traceRoute(deviceId) {
        // Clear previous route
        if (routeLayer) {
            routeLayer.setMap(null);
        }

        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'GPS Log',
                fields: ['latitude', 'longitude', 'recieved_at'],
                filters: [['device_id', '=', deviceId]],
                order_by: 'recieved_at asc',
                limit_page_length: 100
            },
            callback: function(response) {
                let routePoints = response.message.map(log => new google.maps.LatLng(log.latitude, log.longitude));
                routeLayer = new google.maps.Polyline({
                    path: routePoints,
                    geodesic: true,
                    strokeColor: '#FF0000',
                    strokeOpacity: 0.5,
                    strokeWeight: 3
                });
                routeLayer.setMap(map);

                let bounds = new google.maps.LatLngBounds();
                routePoints.forEach(point => bounds.extend(point));
                map.fitBounds(bounds);
            }
        });
    }

    // Event listeners
    $('#zoom-in').on('click', () => map.setZoom(map.getZoom() + 1));
    $('#zoom-out').on('click', () => map.setZoom(map.getZoom() - 1));
    $('#refresh-data').on('click', () => updateTrackingData($('#time-range').val()));

    $('#map-view').on('click', function() {
        $(this).addClass('active').siblings().removeClass('active');
        $('#map-container').removeClass('d-none');
        $('#list-container').addClass('d-none');
        google.maps.event.trigger(map, 'resize');
    });

    $('#list-view').on('click', function() {
        $(this).addClass('active').siblings().removeClass('active');
        $('#list-container').removeClass('d-none');
        $('#map-container').addClass('d-none');
    });

    $('#search-input').on('input', function() {
        let query = $(this).val().toLowerCase();
        $('.vehicle-item').each(function() {
            $(this).toggle($(this).text().toLowerCase().includes(query));
        });
    });

    $('#status-filter').on('change', function() {
        let status = $(this).val();
        $('.vehicle-item').each(function() {
            let deviceId = $(this).data('device-id');
            let vehicleInfo = vehicleData[deviceId];
            if (status === 'all' || 
                (status === 'moving' && vehicleInfo.speed > 5) ||
                (status === 'stopped' && vehicleInfo.speed === 0) ||
                (status === 'idle' && vehicleInfo.speed > 0 && vehicleInfo.speed <= 5)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });
    
        $('#time-range').on('change', function() {
            updateTrackingData($(this).val());
        });
    
        $('#vehicle-list').on('click', '.vehicle-item', function(e) {
            e.preventDefault();
            let deviceId = $(this).data('device-id');
            focusVehicle(deviceId);
        });
    
        $(document).on('click', '.trace-route', function() {
            let deviceId = $(this).data('device-id');
            traceRoute(deviceId);
            $('#map-view').click();
        });
    
        $('#toggle-theme').on('click', function() {
            $('body').toggleClass('dark-theme');
            updateMapStyles();
        });
    
        function focusVehicle(deviceId) {
            let marker = markers[deviceId];
            if (marker) {
                map.setCenter(marker.getPosition());
                map.setZoom(15);
                google.maps.event.trigger(marker, 'click');
    
                // Highlight selected vehicle
                $('.vehicle-item').removeClass('active');
                $(`.vehicle-item[data-device-id="${deviceId}"]`).addClass('active');
            }
        }
    
        function getStatusColor(speed) {
            if (speed > 5) return '#28a745'; // Moving
            if (speed > 0) return '#ffc107'; // Idle
            return '#dc3545'; // Stopped
        }
    
        function toggleLoading(show) {
            const spinner = document.getElementById('loading-spinner');
            if (spinner) {
                spinner.style.display = show ? 'block' : 'none';
            }
        }
    
        function handleFetchError(err) {
            console.error('Error fetching GPS log:', err);
            frappe.show_alert({
                message: __('Failed to fetch vehicle data. Please try again later.'),
                indicator: 'red'
            });
        }
    
        function updateListView(logs) {
            let tableBody = logs.map(log => `
                <tr>
                    <td>${log.vehicle || `Device ${log.device_id}`}</td>
                    <td>${getStatusBadge(log.speed)}</td>
                    <td>${log.speed} km/h</td>
                    <td>${log.recieved_at}</td>
                    <td>
                        <button class="btn btn-sm btn-info locate-vehicle" data-device-id="${log.device_id}">
                            <i class="fa fa-map-marker-alt"></i> Locate
                        </button>
                        <button class="btn btn-sm btn-primary trace-route" data-device-id="${log.device_id}">
                            <i class="fa fa-route"></i> Trace Route
                        </button>
                    </td>
                </tr>
            `).join('');
            $('#vehicle-table-body').html(tableBody);
        }
    
        function addCustomControls() {
            // Add custom info control
            const infoControlDiv = document.createElement('div');
            const infoControl = new InfoControl(infoControlDiv, map);
            map.controls[google.maps.ControlPosition.TOP_LEFT].push(infoControlDiv);
    
            // Add custom legend control
            const legendControlDiv = document.createElement('div');
            const legendControl = new LegendControl(legendControlDiv, map);
            map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(legendControlDiv);
    
            // Add custom statistics control
            const statisticsControlDiv = document.createElement('div');
            statisticsControl = new StatisticsControl(statisticsControlDiv, map);
            map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(statisticsControlDiv);
        }
    
        // Custom Info Control
        function InfoControl(controlDiv, map) {
            const controlUI = document.createElement('div');
            controlUI.style.backgroundColor = '#fff';
            controlUI.style.border = '2px solid #fff';
            controlUI.style.borderRadius = '3px';
            controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
            controlUI.style.cursor = 'pointer';
            controlUI.style.marginTop = '10px';
            controlUI.style.marginLeft = '10px';
            controlUI.style.textAlign = 'center';
            controlUI.title = 'Click for information';
            controlDiv.appendChild(controlUI);
    
            const controlText = document.createElement('div');
            controlText.style.color = 'rgb(25,25,25)';
            controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
            controlText.style.fontSize = '16px';
            controlText.style.lineHeight = '38px';
            controlText.style.paddingLeft = '5px';
            controlText.style.paddingRight = '5px';
            controlText.innerHTML = '<i class="fa fa-info"></i>';
            controlUI.appendChild(controlText);
    
            controlUI.addEventListener('click', () => {
                showInfoModal();
            });
        }
    
        // Custom Legend Control
        function LegendControl(controlDiv, map) {
            const controlUI = document.createElement('div');
            controlUI.style.backgroundColor = '#fff';
            controlUI.style.border = '2px solid #fff';
            controlUI.style.borderRadius = '3px';
            controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
            controlUI.style.cursor = 'pointer';
            controlUI.style.marginBottom = '22px';
            controlUI.style.marginRight = '10px';
            controlUI.style.textAlign = 'left';
            controlUI.title = 'Legend';
            controlDiv.appendChild(controlUI);
    
            const controlText = document.createElement('div');
            controlText.style.color = 'rgb(25,25,25)';
            controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
            controlText.style.fontSize = '12px';
            controlText.style.lineHeight = '20px';
            controlText.style.paddingLeft = '5px';
            controlText.style.paddingRight = '5px';
            controlText.innerHTML = `
                <h4>Vehicle Status</h4>
                <div><span class="status-badge moving"></span> Moving</div>
                <div><span class="status-badge idle"></span> Idle</div>
                <div><span class="status-badge stopped"></span> Stopped</div>
            `;
            controlUI.appendChild(controlText);
        }
    
        // Custom Statistics Control
        function StatisticsControl(controlDiv, map) {
            const controlUI = document.createElement('div');
            controlUI.style.backgroundColor = '#fff';
            controlUI.style.border = '2px solid #fff';
            controlUI.style.borderRadius = '3px';
            controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
            controlUI.style.cursor = 'pointer';
            controlUI.style.marginBottom = '22px';
            controlUI.style.marginLeft = '10px';
            controlUI.style.textAlign = 'left';
            controlUI.title = 'Statistics';
            controlDiv.appendChild(controlUI);
    
            const controlText = document.createElement('div');
            controlText.style.color = 'rgb(25,25,25)';
            controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
            controlText.style.fontSize = '12px';
            controlText.style.lineHeight = '20px';
            controlText.style.paddingLeft = '5px';
            controlText.style.paddingRight = '5px';
            controlUI.appendChild(controlText);
    
            this.updateStatistics = function() {
                let movingCount = 0, idleCount = 0, stoppedCount = 0;
                Object.values(vehicleData).forEach(vehicle => {
                    if (vehicle.speed > 5) movingCount++;
                    else if (vehicle.speed > 0) idleCount++;
                    else stoppedCount++;
                });
    
                controlText.innerHTML = `
                    <h4>Fleet Statistics</h4>
                    <div>Moving: ${movingCount}</div>
                    <div>Idle: ${idleCount}</div>
                    <div>Stopped: ${stoppedCount}</div>
                    <div>Total: ${Object.keys(vehicleData).length}</div>
                `;
            };
    
            // Initial update
            this.updateStatistics();
        }
    
        function showInfoModal() {
            frappe.msgprint({
                title: __('Vehicle Tracking Information'),
                indicator: 'blue',
                message: `
                    <p>Welcome to the Vehicle Tracking System!</p>
                    <ul>
                        <li>Use the search bar to find specific vehicles.</li>
                        <li>Filter vehicles by their current status.</li>
                        <li>Click on a vehicle in the list to locate it on the map.</li>
                        <li>Switch between map and list views for different perspectives.</li>
                        <li>The map updates every 30 seconds, but you can manually refresh using the refresh button.</li>
                        <li>Use the time range filter to view historical data.</li>
                        <li>Click 'Trace Route' to see a vehicle's recent path.</li>
                    </ul>
                `
            });
        }
    
        function getMapStyles() {
            return $('body').hasClass('dark-theme') ? [
                {elementType: 'geometry', stylers: [{color: '#242f3e'}]},
                {elementType: 'labels.text.stroke', stylers: [{color: '#242f3e'}]},
                {elementType: 'labels.text.fill', stylers: [{color: '#746855'}]},
                {
                    featureType: 'administrative.locality',
                    elementType: 'labels.text.fill',
                    stylers: [{color: '#d59563'}]
                },
                {
                    featureType: 'poi',
                    elementType: 'labels.text.fill',
                    stylers: [{color: '#d59563'}]
                },
                {
                    featureType: 'poi.park',
                    elementType: 'geometry',
                    stylers: [{color: '#263c3f'}]
                },
                {
                    featureType: 'poi.park',
                    elementType: 'labels.text.fill',
                    stylers: [{color: '#6b9a76'}]
                },
                {
                    featureType: 'road',
                    elementType: 'geometry',
                    stylers: [{color: '#38414e'}]
                },
                {
                    featureType: 'road',
                    elementType: 'geometry.stroke',
                    stylers: [{color: '#212a37'}]
                },
                {
                    featureType: 'road',
                    elementType: 'labels.text.fill',
                    stylers: [{color: '#9ca5b3'}]
                },
                {
                    featureType: 'road.highway',
                    elementType: 'geometry',
                    stylers: [{color: '#746855'}]
                },
                {
                    featureType: 'road.highway',
                    elementType: 'geometry.stroke',
                    stylers: [{color: '#1f2835'}]
                },
                {
                    featureType: 'road.highway',
                    elementType: 'labels.text.fill',
                    stylers: [{color: '#f3d19c'}]
                },
                {
                    featureType: 'transit',
                    elementType: 'geometry',
                    stylers: [{color: '#2f3948'}]
                },
                {
                    featureType: 'transit.station',
                    elementType: 'labels.text.fill',
                    stylers: [{color: '#d59563'}]
                },
                {
                    featureType: 'water',
                    elementType: 'geometry',
                    stylers: [{color: '#17263c'}]
                },
                {
                    featureType: 'water',
                    elementType: 'labels.text.fill',
                    stylers: [{color: '#515c6d'}]
                },
                {
                    featureType: 'water',
                    elementType: 'labels.text.stroke',
                    stylers: [{color: '#17263c'}]
                }
            ] : [];
        }
    
        function updateMapStyles() {
            map.setOptions({ styles: getMapStyles() });
        }
    
        // Load Google Maps API and initialize the map
        function loadGoogleMapsAPI() {
            const script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyBDaeWicvigtP9xPv919E-RNoxfvC-Hqik';
            script.defer = true;
            script.async = true;
            script.onload = initializeMap;
            document.head.appendChild(script);
        }
    
        // Call the function to load Google Maps API
        loadGoogleMapsAPI();
    };
      
  