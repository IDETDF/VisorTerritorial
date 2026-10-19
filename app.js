
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'esri-world-imagery': {
                type: 'raster',
                tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
            },
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
            // Esri arranca visible por defecto
            { id: 'base-esri', type: 'raster', source: 'esri-world-imagery', layout: { visibility: 'visible' }, minzoom: 0, maxzoom: 19 },
            { id: 'base-topo', type: 'raster', source: 'argenmap-topo', layout: { visibility: 'none' }, minzoom: 0, maxzoom: 18 },
            { id: 'base-gris', type: 'raster', source: 'argenmap-gris', layout: { visibility: 'none' }, minzoom: 0, maxzoom: 18 }
        ]
    },
    center: [-67.8150, -54.6850], // Coordenadas del Paso Garibaldi
    zoom: 11,
    pitch: 0,    
    bearing: 0,  
    maxPitch: 85
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

// --- LÓGICA DE CONTROL DE MAPAS BASE ---
function setupBaseMapControl() {
    const container = document.getElementById('base-maps-list');
    const bases = [
        { id: 'base-esri', name: 'Esri World Imagery (Satelital)', checked: true }, // Por defecto
        { id: 'base-gris', name: 'Argenmap Gris', checked: false },
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

   // --- CAPAS DEL VISOR: ZONA GARIBALDI ---

    // 1. Capas base / Hidrografía y relieve preexistentes
    loadLayerMapLibre('cuencas', 'Cuencas', './data/cuencas.geojson', 'polygon', { 
        color: '#08306b', fillColor: '#4292c6', weight: 1.5, dashArray: [3, 2], fillOpacity: 0.15 
    });
    
    loadLayerMapLibre('cuerpos-agua', 'Cuerpos de Agua', './data/cuerpos_agua.geojson', 'polygon', { 
        color: '#08519c', fillColor: '#3182bd', weight: 1.5, fillOpacity: 0.6 
    });

    loadLayerMapLibre('cursos-agua', 'Cursos de Agua', './data/cursos_agua.geojson', 'line', { 
        color: '#3182bd', weight: 2 
    });

    // 2. Nuevas capas de curvas de nivel (Elegí una o ambas según el rendimiento que prefieras)
    loadLayerMapLibre('curvas-nivel', 'Curvas de Nivel', './data/curvas_nivel.geojson', 'line', { 
        color: '#b2b2b2', weight: 1 
    });

    // 3. Capas de relieve e infraestructura
    loadLayerMapLibre('cerros', 'Cerros', './data/cerros.geojson', 'point', { 
        color: '#ffffff', fillColor: '#d95f02', radius: 6, weight: 2 
    });

    loadLayerMapLibre('red-vial', 'Red Vial', './data/red_vial.geojson', 'line', { 
        color: '#252525', weight: 2.5 
    });

    loadLayerMapLibre('parcelario-rural', 'Parcelario Rural', './data/parcelario_rural.geojson', 'polygon', { 
        color: '#737373', fillColor: '#bdbdbd', weight: 1, fillOpacity: 0.2 
    });

    // 4. Áreas protegidas, normativas y ambientales
    loadLayerMapLibre('ley-597', 'Áreas Ley 597', './data/ley_597.geojson', 'polygon', { 
        color: '#54278f', fillColor: '#9e9ac8', weight: 1.5, fillOpacity: 0.2 
    });

    loadLayerMapLibre('subareas-597', 'Subáreas Ley 597', './data/subareas_ley_597.geojson', 'polygon', { 
        color: '#3f007d', fillColor: '#6a51a3', weight: 2, fillOpacity: 0.35 
    });

    loadLayerMapLibre('reserva-tdf', 'Reservas Naturales', './data/sistema_provincial_de_areas_naturales_protegidas_ide_tdf_marzo.geojson', 'polygon', { 
        color: '#006d2c', fillColor: '#41ab5d', weight: 1.5, fillOpacity: 0.2 
    });

    loadLayerMapLibre('otbn', 'Bosques Nativos (OTBN)', './data/otbn.geojson', 'polygon', { 
        color: [
            'match',
            ['get', 'cat_otbn'], // Reemplazá 'categoria' por el nombre real del campo si es distinto (ej: 'cat', 'id_', etc.)
            '1-Rojo', '#d73027',       // Categoría I - Rojo (Muy alto valor de conservación)
            '2-Amarillo', '#fee08b',       // Categoría II - Amarillo (Mediano valor de conservación)
            '3-Verde', '#1a9850',       // Categoría III - Verde (Bajo valor de conservación - por si hubiera)
            '#999999'             // Valor por defecto
        ],
        fillColor: [
            'match',
            ['get', 'cat_otbn'],
            '1-Rojo', '#d73027',
            '2-Amarillo', '#fee08b',
            '3-Verde', '#1a9850',
            '#999999'
        ],
        weight: 1, 
        fillOpacity: 0.5
    });

    loadLayerMapLibre('cobertura-suelo', 'Cobertura de Suelo', './data/cobertura_suelo.geojson', 'polygon', { 
        color: [
            'match', ['get', 'tcs'],
            'Bosques_cerrados', '#1b7837',
            'Bosques_abiertos', '#7fbc41',
            'Arbustal_abierto', '#d9f0d3',
            'Herbaceas_cerradas', '#a6dba0',
            'Pastizal_abierto', '#c2a5cf',
            'Areas_urbanas', '#737373',
            'Cuerpos_de_agua', '#2166ac',
            'Nieve', '#f7f7f7',
            'Rocas', '#b2abd2',
            'Suelos_pedregozos', '#dfc27d',
            '#cccccc' // Valor por defecto si hay alguna categoría no contemplada
        ],
        fillColor: [
            'match', ['get', 'tcs'],
            'Bosques_cerrados', '#1b7837',
            'Bosques_abiertos', '#7fbc41',
            'Arbustal_abierto', '#d9f0d3',
            'Herbaceas_cerradas', '#a6dba0',
            'Pastizal_abierto', '#c2a5cf',
            'Areas_urbanas', '#737373',
            'Cuerpos_de_agua', '#2166ac',
            'Nieve', '#f7f7f7',
            'Rocas', '#b2abd2',
            'Suelos_pedregozos', '#dfc27d',
            '#cccccc'
        ],
        weight: 0.5, 
        fillOpacity: 0.55
    });

    loadLayerMapLibre('humedales', 'Humedales', './data/humedales.geojson', 'polygon', { 
        color: '#2b8cbe', 
        fillColor: '#74a9cf', 
        weight: 1, 
        fillOpacity: 0.35 
    });

    loadLayerMapLibre('senderos-trekking', 'Senderos para Trekking', './data/senderos_para_trekking.geojson', 'line', { 
        color: '#e08214', 
        weight: 2.5, 
        dashArray: [3, 2] // Línea punteada característica para senderos y picadas
    });

    loadLayerMapLibre('ordenamiento-turberas', 'Ordenamiento de Turberas', './data/ordenamiento_turberas.geojson', 'polygon', { 
        color: '#8c6d31', fillColor: '#e7ba52', weight: 1.5, fillOpacity: 0.4 
    });

    // 5. Capas temáticas y de eventos específicos
    loadLayerMapLibre('sitios-fuego', 'Sitios Habilitados para Hacer Fuego', './data/sitios_habilitados_para_hacer_fuego.geojson', 'point', { 
        color: '#ffffff', fillColor: '#e41a1c', radius: 7, weight: 2 
    });

    loadLayerMapLibre('volteos-forestales', 'Volteos Forestales por Viento', './data/volteos_forestales_por_viento.geojson', 'polygon', { 
        color: '#a63603', fillColor: '#fd8d3c', weight: 1.5, fillOpacity: 0.5 
    });

    loadLayerMapLibre('mojones', 'Mojones', './data/mojones.geojson', 'point', { 
        color: '#ffffff', fillColor: '#252525', radius: 5, weight: 2 
    });

    loadLayerMapLibre('castoreras', 'Castoreras', './data/castoreras.geojson', 'point', { 
        color: '#8c510a', fillColor: '#bf812d', radius: 6, weight: 1.5 
    });

    loadLayerMapLibre('equipamiento-institucional', 'Equipamiento Institucional', './data/equipamiento_institucional.geojson', 'point', { 
        color: '#ffffff', fillColor: '#2171b3', radius: 6, weight: 2 
    });

    loadLayerMapLibre('gasoducto', 'Gasoducto', './data/gasoducto.geojson', 'line', { 
        color: '#cb181d', weight: 2.5 
    });

    loadLayerMapLibre('fibra-optica', 'Fibra Óptica', './data/fibra_optica.geojson', 'line', { 
        color: '#2ca25f', weight: 2, dashArray: [2, 2] // Línea punteada para diferenciar la fibra
    });

    loadLayerMapLibre('refugios', 'Refugios', './data/refugios.geojson', 'point', { 
        color: '#ffffff', fillColor: '#006d2c', radius: 7, weight: 2 
    });
});