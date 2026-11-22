import {initAuth} from './auth.js';
import {initMap, requestUserLocation} from './map.js';
import {initMenuEvents} from './menu.js';
import {
  applyFilters,
  initRestaurantEvents,
  loadRestaurants,
  selectRestaurantById,
} from './restaurants.js';

initAuth();
initMenuEvents();
initRestaurantEvents();
initMap((restaurantId) => selectRestaurantById(restaurantId));
requestUserLocation(() => applyFilters());
loadRestaurants();
