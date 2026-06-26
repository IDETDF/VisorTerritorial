
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'argenmap-topo': {
                type: 'raster',
                tiles: ['https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_topo@EPSG%3A3857@png/{z}/{x}/{y}.png'],
                tileSize: 256,
                scheme: 'tms'
            },
            'argenmap-gris': {
                type: 'raster',
                tiles: ['https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{y}.png'],
                tileSize: 256,
                scheme: 'tms'
            },
            'maptiler-terrain': {
                type: 'raster-dem',
                tiles: ['https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=yWmkO7XO4p95VYjsc9ho'],
                encoding: 'mapbox',
                tileSize: 256
            }
        },
        layers: [
            
            { id: 'base-topo', type: 'raster', source: 'argenmap-topo', layout: { visibility: 'none' }, minzoom: 0, maxzoom: 18 },
            { id: 'base-gris', type: 'raster', source: 'argenmap-gris', layout: { visibility: 'visible' }, minzoom: 0, maxzoom: 18 }
        ]
    },
    center: [-68.3030, -54.8019],
    zoom: 11.5,
    pitch: 0,    
    bearing: 0,  
    maxPitch: 85
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

// --- LÓGICA DE CONTROL DE MAPAS BASE ---
function setupBaseMapControl() {
    const container = document.getElementById('base-maps-list');
    const bases = [
        { id: 'base-gris', name: 'Argenmap Gris', checked: true }, // Por defecto
        { id: 'base-topo', name: 'Argenmap Topográfico', checked: false }
    ];

    bases.forEach(base => {
        const label = document.createElement('label');
        label.className = 'layer-item';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'basemap';
        radio.value = base.id;
        radio.checked = base.checked;
        
        radio.onchange = (e) => {
            bases.forEach(b => map.setLayoutProperty(b.id, 'visibility', 'none'));
            map.setLayoutProperty(e.target.value, 'visibility', 'visible');
        };

        label.appendChild(radio);
        label.appendChild(document.createTextNode(base.name));
        container.appendChild(label);
    });
}

map.on('load', () => {
    setupBaseMapControl();

    document.getElementById('toggle-3d').addEventListener('change', (e) => {
        if (e.target.checked) {
            map.setTerrain({ source: 'maptiler-terrain', exaggeration: 1.2 });
            map.easeTo({ pitch: 65, bearing: -15, duration: 1200 });
        } else {
            map.setTerrain(null);
            map.easeTo({ pitch: 0, bearing: 0, duration: 1200 });
        }
    });

    function loadLayerMapLibre(id, name, url, geometryType, style) {
        map.addSource(id, { type: 'geojson', data: url });
        const fillId = `${id}-fill`;
        const lineId = `${id}-line`;
        const circleId = `${id}-circle`;

        if (geometryType === 'polygon') {
            map.addLayer({
                id: fillId, type: 'fill', source: id,
                layout: { 'visibility': 'none' }, 
                paint: { 'fill-color': style.fillColor, 'fill-opacity': style.fillOpacity || 0.5 }
            });
            map.addLayer({
                id: lineId, type: 'line', source: id,
                layout: { 'visibility': 'none' },
                paint: { 'line-color': style.color, 'line-width': style.weight || 2, 'line-dasharray': style.dashArray || [1] }
            });
            setupPopup(fillId);
        } else if (geometryType === 'line') {
            map.addLayer({
                id: lineId, type: 'line', source: id,
                layout: { 'visibility': 'none' }, // Inicia apagado
                paint: { 'line-color': style.color, 'line-width': style.weight || 2, 'line-dasharray': style.dashArray || [1] }
            });
            setupPopup(lineId);
     } else if (geometryType === 'point') {
            map.addLayer({
                id: circleId, type: 'circle', source: id,
                layout: { 'visibility': 'none' },
                paint: {
                    'circle-radius': style.radius || 6,
                    'circle-color': style.fillColor || style.color,
                    'circle-stroke-width': style.weight || 2,
                    'circle-stroke-color': style.color || '#ffffff' 
                }
            });
            setupPopup(circleId);
        }

        createOverlayCheckbox(id, name, geometryType);
    }

    function createOverlayCheckbox(id, name, geometryType) {
        const container = document.getElementById('overlays-list');
        const label = document.createElement('label');
        label.className = 'layer-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false;
        
        checkbox.onchange = (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            if (map.getLayer(`${id}-line`)) map.setLayoutProperty(`${id}-line`, 'visibility', visibility);
            if (geometryType === 'polygon' && map.getLayer(`${id}-fill`)) {
                map.setLayoutProperty(`${id}-fill`, 'visibility', visibility);
            }
            if (geometryType === 'point' && map.getLayer(`${id}-circle`)) {
                map.setLayoutProperty(`${id}-circle`, 'visibility', visibility);
            }
        };

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(name));
        container.appendChild(label);
    }

    function setupPopup(layerId) {
        map.on('click', layerId, (e) => {
            const properties = e.features[0].properties;
            let popupContent = '<div class="popup-container"><table class="popup-table">';
            for (const [key, value] of Object.entries(properties)) {
                const displayValue = (value !== null && value !== undefined) ? value : '-';
                popupContent += `<tr><th>${key}</th><td>${displayValue}</td></tr>`;
            }
            popupContent += '</table></div>';
            new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
        });
        map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
    }

    loadLayerMapLibre('ejido-actual', 'Ejido Urbano Actual', './data/ejido_actual.geojson', 'polygon', { color: '#800026', fillColor: '#e31a1c', weight: 2, fillOpacity: 0.5 });
    loadLayerMapLibre('ejido-propuesto', 'Ejido Urbano Propuesto', './data/ejido_propuesto.geojson', 'polygon', { color: '#bd0026', fillColor: '#fd8d3c', weight: 3, dashArray: [2, 2], fillOpacity: 0.4 });
    loadLayerMapLibre('ley-597', 'Áreas Ley 597', './data/ley_597.geojson', 'polygon', { color: '#54278f', fillColor: '#9e9ac8', weight: 1.5, fillOpacity: 0.2 });
    loadLayerMapLibre('subareas-597', 'Subáreas Ley 597', './data/subareas_ley_597.geojson', 'polygon', { color: '#3f007d', fillColor: '#6a51a3', weight: 2, fillOpacity: 0.35 });
    loadLayerMapLibre('pn-tdf', 'Parque Nacional TDF', './data/parque_nacional_tdf.geojson', 'polygon', { color: '#00441b', fillColor: '#238b45', weight: 2, fillOpacity: 0.25 });
    loadLayerMapLibre('reserva-tdf', 'Reservas Naturales', './data/sistema_provincial_de_areas_naturales_protegidas_ide_tdf_marzo.geojson', 'polygon', { color: '#006d2c', fillColor: '#41ab5d', weight: 1.5, fillOpacity: 0.2 });
    loadLayerMapLibre('cuencas', 'Cuencas', './data/cuencas.geojson', 'polygon', { color: '#08306b', fillColor: '#4292c6', weight: 1.5, dashArray: [3, 2], fillOpacity: 0.15 });
    loadLayerMapLibre('cursos-agua', 'Cursos de Agua', './data/cursos_agua.geojson', 'line', { color: '#3182bd', weight: 2 });
    loadLayerMapLibre('red-vial', 'Red Vial', './data/red_vial.geojson', 'line', { color: '#252525', weight: 2.5 });
    loadLayerMapLibre('tierra-mayor', 'Tierra Mayor', './data/tierra_mayor.geojson', 'polygon', { 
        color: '#2ca25f', fillColor: '#74c476', weight: 1.5, fillOpacity: 0.2 
    });
    loadLayerMapLibre('sitios-ramsar', 'Sitios RAMSAR', './data/sitios_ramsar.geojson', 'polygon', { 
        color: '#016c59', fillColor: '#1c9099', weight: 2, dashArray: [4, 4], fillOpacity: 0.3 
    });
    loadLayerMapLibre('cuerpos-agua', 'Cuerpos de Agua', './data/cuerpos_agua.geojson', 'polygon', { 
        color: '#08519c', fillColor: '#3182bd', weight: 1.5, fillOpacity: 0.6 
    });

    loadLayerMapLibre('centros-invernales', 'Centros de Montaña', './data/centros_invernales.geojson', 'point', { 
        color: '#ffffff',
        fillColor: '#ce1256',
        radius: 7, 
        weight: 2 
    });

    loadLayerMapLibre('otbn', 'Bosques Nativos', './data/otbn.geojson', 'polygon', { 
        color: [
            'match',
            ['get', 'id_'],
            1, '#417505', 
            2, '#a69979', 
            3, '#b8e986', 
            4, '#000000', 
            5, '#000000', 
            6, '#000000', 
            '#31a354'     
        ],
        fillColor: [
            'match',
            ['get', 'id_'],
            1, '#417505',
            2, '#a69979',
            3, '#b8e986',
            4, '#000000',
            5, '#000000',
            6, '#000000',
            '#a1d99b'     
        ],
        weight: 1, 
        fillOpacity: 0.6
    });
});