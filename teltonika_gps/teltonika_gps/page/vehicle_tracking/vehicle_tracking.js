frappe.pages['vehicle-tracking'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Vehicle Tracking',
        single_column: true
    });

    // Add content to the page
    page.main.html(`
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
                </div>
                <div id="map-container">
                    <div class="loading-spinner" id="loading-spinner"></div>
                    <!-- Map will be rendered here -->
                </div>
                <div id="list-container" class="d-none">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Device ID</th>
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
            height: calc(100vh - 140px);
        }
        .sidebar {
            width: 300px;
            padding: 15px;
            background-color: #f4f5f7;
            border-right: 1px solid #e4e5e7;
            overflow-y: auto;
        }
        .main-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
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
    `);

    // Initialize map
    let map = L.map('map-container').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let markers = {};
    let vehicleData = {};

    function fetchLatestGPSLogs() {
        toggleLoading(true);
        return frappe.call({
            method: 'teltonika_gps.teltonika_gps.api.rest.get_latest_gps_logs',
        }).then(r => {
            toggleLoading(false);
            return r.message;
        }).catch(err => {
            toggleLoading(false);
            handleFetchError(err);
        });
    }

    function handleFetchError(err) {
        console.error('Error fetching GPS logs:', err);
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
                        <h5 class="mb-1">Device ${log.device_id}</h5>
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
                <td>Device ${log.device_id}</td>
                <td>${getStatusBadge(log.speed)}</td>
                <td>${log.speed} km/h</td>
                <td>${log.recieved_at}</td>
                <td>
                    <button class="btn btn-sm btn-info locate-vehicle" data-device-id="${log.device_id}">
                        <i class="fa fa-map-marker-alt"></i> Locate
                    </button>
                </td>
            </tr>
        `).join('');
        $('#vehicle-table-body').html(tableBody);
    }

    function updateMarkers(logs) {
        let bounds = L.latLngBounds();

        logs.forEach(log => {
            let position = [log.latitude, log.longitude];
            let markerHtml = `<div class="pulsing-icon"></div>`;
            if (markers[log.device_id]) {
                markers[log.device_id].setLatLng(position);
            } else {
                markers[log.device_id] = L.marker(position, {
                    icon: L.divIcon({
                        html: markerHtml,
                        className: '',
                        iconSize: [20, 20],
                    })
                }).addTo(map);
            }

            markers[log.device_id].bindPopup(`
                <b>Device ${log.device_id}</b><br>
                Status: ${getStatusBadge(log.speed)}<br>
                Speed: ${log.speed} km/h<br>
                Heading: ${log.heading}°<br>
                Last Updated: ${log.recieved_at}
            `);

            bounds.extend(position);
        });

        if (bounds.isValid()) {
            map.fitBounds(bounds);
        } else {
            map.setView([0, 0], 2);
        }
    }

    function updateTrackingData() {
        fetchLatestGPSLogs().then(logs => {
            if (logs) {
                updateVehicleList(logs);
                updateMarkers(logs);
            }
        });
    }

    // Initial data load
    updateTrackingData();
    let refreshInterval = setInterval(updateTrackingData, 30000);

    // Event listeners
    $('#zoom-in').on('click', () => map.zoomIn());
    $('#zoom-out').on('click', () => map.zoomOut());
    $('#refresh-data').on('click', updateTrackingData);

    $('#map-view').on('click', function() {
        $(this).addClass('active').siblings().removeClass('active');
        $('#map-container').removeClass('d-none');
        $('#list-container').addClass('d-none');
        map.invalidateSize();
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
            let vehicle = vehicleData[deviceId];
            if (status === 'all' || 
                (status === 'moving' && vehicle.speed > 5) ||
                (status === 'stopped' && vehicle.speed === 0) ||
                (status === 'idle' && vehicle.speed > 0 && vehicle.speed <= 5)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
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

    function focusVehicle(deviceId) {
        let marker = markers[deviceId];
        if (marker) {
            map.setView(marker.getLatLng(), 15);
            marker.openPopup();

            // Highlight selected vehicle
            $('.list-group-item').removeClass('active');
            $(`.list-group-item[data-device-id="${deviceId}"]`).addClass('active');
            Object.values(markers).forEach(m => m.setIcon(L.divIcon({
                html: `<div class="pulsing-icon"></div>`,
                className: '',
                iconSize: [20, 20],
            })));
            marker.setIcon(L.divIcon({
                html: `<div class="pulsing-icon selected"></div>`,
                className: '',
                iconSize: [30, 30],
            }));
        }
    }

    // Clean up on page change
    // page.on('hide', function() {
    //     clearInterval(refreshInterval);
    // });
}
