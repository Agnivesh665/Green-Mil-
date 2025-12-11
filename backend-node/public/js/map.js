if (typeof roadGeo !== "undefined") {

    const map = L.map('map').setView([start.lat, start.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);

    // Start marker
    L.marker([start.lat, start.lng]).addTo(map).bindPopup("Start");

    // End marker
    L.marker([end.lat, end.lng]).addTo(map).bindPopup("Destination");

    // Convert OSRM geometry
    const coords = roadGeo.coordinates.map(c => [c[1], c[0]]);

    // Road polyline
    const routeLine = L.polyline(coords, {
        color: "blue",
        weight: 6
    }).addTo(map);

    map.fitBounds(routeLine.getBounds());

    // mid point label
    const mid = coords[Math.floor(coords.length / 2)];

    L.marker(mid, {
        icon: L.divIcon({
            html: `<div style="
                background:white;
                padding:6px 12px;
                border-radius:20px;
                border:1px solid #aaa;
                font-weight:600;
                box-shadow:0 2px 4px rgba(0,0,0,0.2);
            ">
                ${distance} km
            </div>`
        })
    }).addTo(map);
}
