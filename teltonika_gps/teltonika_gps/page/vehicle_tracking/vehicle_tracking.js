frappe.pages['vehicle-tracking'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Vehicle Tracking',
        single_column: true
    });

    $(wrapper).find('.page-content').css({
        'max-width': '100%',
        'padding-left': '0',
        'padding-right': '0'
    });

    $(wrapper).find('.layout-main-section').css({
        'display': 'flex',
        'height': 'calc(100vh - 60px)', // Adjust for the top navbar
        'margin': '0',
        'padding': '0',
        'max-width': '100%'
    });

    // Add content to the page
    $(wrapper).find('.layout-main-section').html(`
        <div class="vehicle-tracking-container">
            <div class="sidebar">
                <div class="filter-section mb-3">
                    <input type="text" class="form-control" id="search-input" placeholder="Search vehicles...">
                    <select class="form-control mt-2" id="status-filter">
                        <option value="all">All Status</option>
                        <option value="moving">Moving</option>
                        <option value="stopped">Stopped</option>
                        <option value="idle">Idle</option>
                    </select>
                    <div class="mt-2">
                        <label for="time-range">Time Range:</label>
                        <select class="form-control" id="time-range">
                            <option value="all">All Time</option>
                            <option value="1h">Last Hour</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                        </select>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">Vehicle List</div>
                    <div class="card-body p-0">
                        <div id="vehicle-list" class="list-group list-group-flush">
                            <!-- Vehicle list will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
            <div class="main-content">
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
                    <div class="theme-switcher">
                        <label for="theme-select">Theme:</label>
                        <select id="theme-select" class="form-control form-control-sm">
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>
                </div>
                <div id="map-container">
                    <div class="loading-spinner" id="loading-spinner"></div>
                    <!-- Map will be rendered here -->
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
                        <tbody id="vehicle-table-body">
                            <!-- Table rows will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `);

    // Add custom styles
    frappe.dom.set_style(`
        .vehicle-tracking-container {
            display: flex;
            height: 100%;
            width: 100%;
        }
        .sidebar {
            width: 300px;
            padding: 15px;
            background-color: #f4f5f7;
            border-right: 1px solid #e4e5e7;
            overflow-y: auto;
            transition: width 0.3s ease;
            flex-shrink: 0;
        }
        .sidebar.collapsed {
            width: 60px;
        }
        .main-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .toolbar {
            padding: 10px;
            background-color: #e9ecef;
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #dee2e6;
        }
        #map-container, #list-container {
            flex-grow: 1;
            position: relative;
            background-color: #f8f9fa;
        }
        .loading-spinner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top-color: #007bff;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            display: none;
        }
        @keyframes spin {
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .list-group-item {
            cursor: pointer;
            padding: 10px;
            border-bottom: 1px solid #dee2e6;
            transition: background-color 0.2s ease;
        }
        .list-group-item:hover {
            background-color: #e9ecef;
        }
        .pulsing-icon {
            background-color: #28a745;
            border-radius: 50%;
            width: 12px;
            height: 12px;
            display: inline-block;
            box-shadow: 0 0 6px 2px rgba(40, 167, 69, 0.6);
            animation: pulse 2s infinite;
        }
        .selected-vehicle .pulsing-icon {
            background-color: #ffc107;
            box-shadow: 0 0 8px 4px rgba(255, 193, 7, 0.6);
        }
        @keyframes pulse {
            0% {
                transform: scale(0.9);
                opacity: 1;
            }
            70% {
                transform: scale(1.2);
                opacity: 0.7;
            }
            100% {
                transform: scale(0.9);
                opacity: 1;
            }
        }
        #toggle-sidebar {
            position: absolute;
            top: 10px;
            left: 310px;
            z-index: 1000;
            transition: left 0.3s ease;
        }
        .sidebar.collapsed + .main-content #toggle-sidebar {
            left: 70px;
        }
        .leaflet-control-layers {
            max-height: none !important;
            max-width: none !important;
        }
        .leaflet-control-layers-expanded {
            display: block !important;
        }
        .dark-theme {
            background-color: #333;
            color: #fff;
        }
        .dark-theme .sidebar {
            background-color: #444;
            border-right-color: #555;
        }
        .dark-theme .toolbar {
            background-color: #555;
        }
        .dark-theme .list-group-item {
            background-color: #444;
            color: #fff;
            border-color: #555;
        }
        .dark-theme .list-group-item:hover {
            background-color: #555;
        }
    `);

    let map, markers = {}, vehicleData = {}, routeLayer, statisticsControl;

window.initializeMap = function() {
    try {
        console.log("Initializing map...");
        // Check if map container exists
        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) {
            throw new Error("Map container not found");
        }

        // Initialize the map centered on Kenya
        map = new google.maps.Map(mapContainer, {
            center: { lat: -1.286389, lng: 36.817223 },
            zoom: 7,
            fullscreenControl: true,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                mapTypeIds: ['roadmap', 'satellite']
            }
        });

        console.log("Map initialized successfully");

        // Add custom controls
        addCustomControls();

        // Initialize markers layer
        markers = {};

        // Initial data load
        updateTrackingData();
        setInterval(updateTrackingData, 30000);
    } catch (error) {
        console.error("Error initializing map:", error);
        frappe.msgprint({
            title: __('Map Initialization Error'),
            indicator: 'red',
            message: __('Failed to initialize the map. Please refresh the page and try again.')
        });
    }
}

// Load Google Maps API
var script = document.createElement('script');
script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY&callback=initializeMap';
script.async = true;
script.defer = true;
script.onerror = function() {
    console.error("Failed to load Google Maps API");
    frappe.msgprint({
        title: __('Google Maps API Error'),
        indicator: 'red',
        message: __('Failed to load Google Maps API. Please check your internet connection and try again.')
    });
};
document.head.appendChild(script);

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
        <div><span class="pulsing-icon" style="background-color: #28a745;"></span> Moving</div>
        <div><span class="pulsing-icon" style="background-color: #ffc107;"></span> Idle</div>
        <div><span class="pulsing-icon" style="background-color: #dc3545;"></span> Stopped</div>
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

    function handleFetchError(err) {
        console.error('Error fetching GPS log:', err);
        frappe.show_alert({
            message: __('Failed to fetch vehicle data. Please try again later.'),
            indicator: 'red'
        });
    }

    function toggleLoading(show) {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.style.display = show ? 'block' : 'none';
        }
    }

    function updateVehicleList(logs) {
        vehicleData = {};
        let vehicleListHTML = logs.map(log => {
            vehicleData[log.device_id] = log;
            return `
                <a href="#" class="list-group-item list-group-item-action" data-device-id="${log.device_id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">${log.vehicle || `Device ${log.device_id}`}</h5>
                        <small>${getStatusBadge(log.speed)}</small>
                    </div>
                    <p class="mb-1">Speed: ${log.speed} km/h</p>
                    <small>Last updated: ${log.recieved_at}</small>
                </a>
            `;
        }).join('');
        $('#vehicle-list').html(vehicleListHTML);
        updateListView(logs);
    }

    function getStatusBadge(speed) {
        if (speed > 5) return '<span class="badge badge-success">Moving</span>';
        if (speed > 0) return '<span class="badge badge-warning">Idle</span>';
        return '<span class="badge badge-danger">Stopped</span>';
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
                markers[log.device_id] = new google.maps.Marker({
                    position: position,
                    map: map,
                    icon: markerIcon
                });

                let infoWindow = new google.maps.InfoWindow({
                    content: `
                        <b>${log.vehicle || `Device ${log.device_id}`}</b><br>
                        Status: ${getStatusBadge(log.speed)}<br>
                        Speed: ${log.speed} km/h<br>
                        Heading: ${log.heading}°<br>
                        Last Updated: ${log.recieved_at}<br>
                        <button class="btn btn-sm btn-primary trace-route" data-device-id="${log.device_id}">Trace Route</button>
                    `
                });

                markers[log.device_id].addListener('click', () => {
                    infoWindow.open(map, markers[log.device_id]);
                });
            }

            bounds.extend(position);
        });

        map.fitBounds(bounds);
    }

    function getStatusColor(speed) {
        if (speed > 5) return '#28a745'; // Moving
        if (speed > 0) return '#ffc107'; // Idle
        return '#dc3545'; // Stopped
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

    function updateStatistics() {
        // Assuming you've stored a reference to your custom StatisticsControl
        if (statisticsControl) {
            statisticsControl.updateStatistics();
        }
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

    function applyTheme(theme) {
        if (theme === 'dark') {
            $('body').addClass('dark-theme');
            if (map) {
                map.getContainer().classList.add('dark-theme');
            }
        } else {
            $('body').removeClass('dark-theme');
            if (map) {
                map.getContainer().classList.remove('dark-theme');
            }
        }
    }

    // Event listeners
    $('#zoom-in').on('click', () => map.zoomIn());
    $('#zoom-out').on('click', () => map.zoomOut());
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
        $('.list-group-item').each(function() {
            $(this).toggle($(this).text().toLowerCase().includes(query));
        });
    });

    $('#status-filter').on('change', function() {
        let status = $(this).val();
        $('.list-group-item').each(function() {
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

    $('#vehicle-list').on('click', '.list-group-item', function(e) {
        e.preventDefault();
        let deviceId = $(this).data('device-id');
        focusVehicle(deviceId);
    });

    $(document).on('click', '.locate-vehicle', function() {
        let deviceId = $(this).data('device-id');
        focusVehicle(deviceId);
        $('#map-view').click();
    });

    $(document).on('click', '.trace-route', function() {
        let deviceId = $(this).data('device-id');
        traceRoute(deviceId);
        $('#map-view').click();
    });

    $('#theme-select').on('change', function() {
        applyTheme($(this).val());
    });

    function focusVehicle(deviceId) {
        let marker = markers[deviceId];
        if (marker) {
            map.setCenter(marker.getPosition());
            map.setZoom(15);
            google.maps.event.trigger(marker, 'click');

            // Highlight selected vehicle
            $('.list-group-item').removeClass('active');
            $(`.list-group-item[data-device-id="${deviceId}"]`).addClass('active');
        }
    }

    // Initialize tooltips
    $('[data-toggle="tooltip"]').tooltip();
};