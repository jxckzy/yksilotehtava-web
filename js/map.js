import {formatAddress, getName} from './dom.js';

const DEFAULT_CENTER = [60.2239, 25.0785]; // Myllypuro / Helsinki area fallback
const DEFAULT_ZOOM = 11;

let map = null;
let markersLayer = null;
let userMarker = null;
let userCoords = null;
const restaurantMarkers = new Map();

const createPinIcon = (variant) =>
  window.L.divIcon({
    className: 'map-pin-icon',
    html: `<span class="map-pin map-pin-${variant}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22],
  });

export const extractCoordinates = (restaurant) => {
  const coords = restaurant?.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {lat, lng};
    }
  }

  const lat = Number(restaurant?.lat ?? restaurant?.latitude);
  const lng = Number(
    restaurant?.lng ?? restaurant?.lon ?? restaurant?.longitude
  );
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {lat, lng};
  }

  return null;
};

export const getDistanceKm = (from, to) => {
  if (!from || !to) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const formatDistanceKm = (km) => {
  if (typeof km !== 'number' || !Number.isFinite(km)) {
    return '';
  }
  return `${km.toFixed(1).replace('.', ',')} km`;
};

export const getUserCoordinates = () => userCoords;

export const initMap = (onSelectRestaurant) => {
  const mapContainer = document.querySelector('.map');
  if (!mapContainer || !window.L) {
    return;
  }

  mapContainer.textContent = '';

  map = window.L.map(mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  markersLayer = window.L.layerGroup().addTo(map);

  if (onSelectRestaurant) {
    map.on('popupopen', (event) => {
      const popupEl = event.popup?.getElement();
      const btn = popupEl?.querySelector('[data-select-restaurant]');
      if (btn) {
        btn.addEventListener(
          'click',
          () => {
            const id = btn.getAttribute('data-select-restaurant');
            onSelectRestaurant(id);
          },
          {once: true}
        );
      }
    });
  }
};

export const requestUserLocation = (onLocationUpdated) => {
  if (!('geolocation' in navigator)) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      if (map && window.L) {
        if (!userMarker) {
          userMarker = window.L.marker([userCoords.lat, userCoords.lng], {
            icon: createPinIcon('red'),
            zIndexOffset: 500,
          })
            .addTo(map)
            .bindPopup('Sinun sijaintisi');
        } else {
          userMarker.setLatLng([userCoords.lat, userCoords.lng]);
          userMarker.setIcon(createPinIcon('red'));
        }
        map.setView([userCoords.lat, userCoords.lng], 12);
      }

      onLocationUpdated?.(userCoords);
    },
    (error) => {
      console.warn('Geolocation unavailable or denied:', error.message);
    },
    {enableHighAccuracy: false, timeout: 8000, maximumAge: 60000}
  );
};

export const renderRestaurantMarkers = (restaurants, favoriteRestaurantId) => {
  if (!map || !markersLayer || !window.L) {
    return;
  }

  markersLayer.clearLayers();
  restaurantMarkers.clear();

  const bounds = [];

  for (const restaurant of restaurants) {
    const coords = extractCoordinates(restaurant);
    if (!coords) {
      continue;
    }

    const isFavorite =
      favoriteRestaurantId &&
      String(restaurant._id) === String(favoriteRestaurantId);

    const dist = userCoords ? getDistanceKm(userCoords, coords) : null;
    const distLine =
      dist !== null ? `<p>${formatDistanceKm(dist)} päässä</p>` : '';

    const marker = window.L.marker([coords.lat, coords.lng], {
      icon: createPinIcon(isFavorite ? 'orange' : 'green'),
      zIndexOffset: isFavorite ? 200 : 0,
    });

    const addressText =
      formatAddress(restaurant) ||
      restaurant.address ||
      'Osoitetta ei saatavilla';

    const favNote = isFavorite
      ? '<p><strong>★ Suosikkiravintola</strong></p>'
      : '';

    const popupContent = `
      <h3>${escapeHtml(getName(restaurant))}</h3>
      ${favNote}
      <p>${escapeHtml(addressText)}</p>
      ${distLine}
      <button type="button" data-select-restaurant="${escapeHtml(
        String(restaurant._id ?? '')
      )}">Näytä ruokalista</button>
    `;

    marker.bindPopup(popupContent);
    marker.addTo(markersLayer);
    bounds.push([coords.lat, coords.lng]);

    if (restaurant._id !== undefined) {
      restaurantMarkers.set(String(restaurant._id), marker);
    }
  }

  if (!userCoords && bounds.length > 0) {
    map.fitBounds(bounds, {padding: [30, 30], maxZoom: 13});
  }
};

export const focusRestaurantOnMap = (restaurant) => {
  if (!map) {
    return;
  }

  const coords = extractCoordinates(restaurant);
  if (!coords) {
    return;
  }

  map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 14), {
    animate: true,
  });

  const marker =
    restaurant._id !== undefined
      ? restaurantMarkers.get(String(restaurant._id))
      : null;
  marker?.openPopup();
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
