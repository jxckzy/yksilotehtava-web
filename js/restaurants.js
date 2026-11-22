import {
  getCurrentUser,
  getFavoriteRestaurantId,
  onAuthChange,
  updateFavoriteRestaurant,
} from './auth.js';
import {
  extractCoordinates,
  focusRestaurantOnMap,
  formatDistanceKm,
  getDistanceKm,
  getUserCoordinates,
  renderRestaurantMarkers,
} from './map.js';
import {fetchData} from './api.js';
import {restaurantsPerPage} from './config.js';
import {createMessage, formatAddress, getName} from './dom.js';
import {getSelectedRestaurant, selectRestaurant} from './menu.js';

const restaurantListElem = document.querySelector('#restaurant-list');
const paginationElem = document.querySelector('#pagination');
const filterFormElem = document.querySelector('.filters');
const searchElem = document.querySelector('#search');
const cityElem = document.querySelector('#city');
const providerElem = document.querySelector('#provider');
const navFavoritesElem = document.querySelector('#nav-favorites');
const navRestaurantsElem = document.querySelector('#nav-restaurants');

let allRestaurants = [];
let listedRestaurants = [];
let currentPage = 1;
let onlyFavorites = false;

const isRestaurantFavorite = (restaurant) => {
  const favId = getFavoriteRestaurantId();
  return Boolean(favId && String(favId) === String(restaurant._id));
};

const syncFavoritesNavUI = () => {
  if (!navFavoritesElem) {
    return;
  }
  navFavoritesElem.classList.toggle('active-nav', onlyFavorites);
  navFavoritesElem.setAttribute('aria-pressed', String(onlyFavorites));
};

const getNearestRestaurantInfo = () => {
  const userCoords = getUserCoordinates();
  if (!userCoords || allRestaurants.length === 0) {
    return null;
  }

  let best = null;
  for (const restaurant of allRestaurants) {
    const coords = extractCoordinates(restaurant);
    if (!coords) {
      continue;
    }
    const distanceKm = getDistanceKm(userCoords, coords);
    if (distanceKm !== null && (!best || distanceKm < best.distanceKm)) {
      best = {restaurant, distanceKm};
    }
  }

  return best;
};

const handleSelectRestaurant = (restaurant, cardElem = null) => {
  const targetCard =
    cardElem ||
    (restaurant._id !== undefined
      ? restaurantListElem.querySelector(
          `[data-restaurant-id="${CSS.escape(String(restaurant._id))}"]`
        )
      : null);

  selectRestaurant(restaurant, targetCard);
  focusRestaurantOnMap(restaurant);
};

export const selectRestaurantById = (restaurantId) => {
  if (!restaurantId) {
    return;
  }
  const found = allRestaurants.find(
    (restaurant) => String(restaurant._id) === String(restaurantId)
  );
  if (found) {
    handleSelectRestaurant(found);
  }
};

const createFavoriteButton = (restaurant) => {
  const isFav = isRestaurantFavorite(restaurant);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = isFav
    ? 'button button-favorite on'
    : 'button button-favorite';
  button.setAttribute('aria-pressed', String(isFav));
  button.setAttribute(
    'aria-label',
    isFav
      ? `Poista ${getName(restaurant)} suosikeista`
      : `Aseta ${getName(restaurant)} suosikiksi`
  );

  const star = document.createElement('span');
  star.className = 'star';
  star.setAttribute('aria-hidden', 'true');
  star.textContent = '★';

  const text = document.createElement('span');
  text.textContent = 'Suosikki';

  button.append(star, text);

  button.addEventListener('click', async (event) => {
    event.stopPropagation();

    if (!getCurrentUser()) {
      window.location.hash = '#login';
      return;
    }

    const nextFavoriteId = isFav ? null : restaurant._id;
    button.disabled = true;

    try {
      await updateFavoriteRestaurant(nextFavoriteId);
      applyFilters();
    } catch (error) {
      console.error('Failed to update favorite restaurant:', error);
    } finally {
      button.disabled = false;
    }
  });

  return button;
};

const createRestaurantCard = (restaurant) => {
  const li = document.createElement('li');
  li.className = 'restaurant';
  if (restaurant._id !== undefined) {
    li.dataset.restaurantId = String(restaurant._id);
  }

  if (restaurant === getSelectedRestaurant()) {
    li.classList.add('selected');
  }

  const nearest = getNearestRestaurantInfo();
  const isNearest =
    nearest && String(nearest.restaurant._id) === String(restaurant._id);

  if (isNearest) {
    li.classList.add('nearest');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `Lähin sinulle · ${formatDistanceKm(nearest.distanceKm)}`;
    li.append(badge);
  }

  const name = document.createElement('h3');
  name.textContent = getName(restaurant);

  const provider = document.createElement('p');
  provider.className = 'provider';
  provider.textContent = restaurant.company || '';

  const address = document.createElement('address');
  address.textContent =
    formatAddress(restaurant) || 'Osoitetta ei ole saatavilla';

  const buttons = document.createElement('div');
  buttons.className = 'restaurant-buttons';

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'button button-outline';
  menuButton.textContent = 'Näytä ruokalista';
  menuButton.addEventListener('click', () =>
    handleSelectRestaurant(restaurant, li)
  );

  const favoriteButton = createFavoriteButton(restaurant);

  buttons.append(menuButton, favoriteButton);
  li.append(name, provider, address, buttons);
  return li;
};

const createPageButton = (text, page, label) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'page-button';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => showPage(page));
  return button;
};

const getVisiblePages = (totalPages) => {
  if (totalPages <= 5) {
    return Array.from({length: totalPages}, (_, index) => index + 1);
  }

  const start = Math.min(Math.max(currentPage - 1, 1), totalPages - 2);
  const shown = [...new Set([1, start, start + 1, start + 2, totalPages])];
  shown.sort((a, b) => a - b);

  const result = [];
  shown.forEach((page, index) => {
    const previous = shown[index - 1];
    if (previous !== undefined) {
      if (page - previous === 2) {
        result.push(previous + 1);
      } else if (page - previous > 2) {
        result.push('...');
      }
    }
    result.push(page);
  });
  return result;
};

const renderPagination = () => {
  const totalPages = Math.ceil(listedRestaurants.length / restaurantsPerPage);

  if (totalPages <= 1) {
    paginationElem.replaceChildren();
    return;
  }

  const buttons = [];

  const previous = createPageButton('‹', currentPage - 1, 'Edellinen sivu');
  previous.disabled = currentPage === 1;
  buttons.push(previous);

  for (const page of getVisiblePages(totalPages)) {
    if (page === '...') {
      const dots = document.createElement('span');
      dots.className = 'page-dots';
      dots.textContent = '...';
      buttons.push(dots);
      continue;
    }

    const button = createPageButton(page, page, 'Sivu ' + page);
    if (page === currentPage) {
      button.classList.add('current');
      button.setAttribute('aria-current', 'page');
    }
    buttons.push(button);
  }

  const next = createPageButton('›', currentPage + 1, 'Seuraava sivu');
  next.disabled = currentPage === totalPages;
  buttons.push(next);

  paginationElem.replaceChildren(...buttons);
};

const showPage = (page) => {
  currentPage = page;

  const start = (page - 1) * restaurantsPerPage;
  const pageRestaurants = listedRestaurants.slice(
    start,
    start + restaurantsPerPage
  );

  if (pageRestaurants.length === 0) {
    const emptyMessage = onlyFavorites
      ? 'Sinulla ei ole vielä suosikkiravintolaa tai hakuehdoilla ei löytynyt suosikkeja.'
      : 'Ravintoloita ei löytynyt.';
    restaurantListElem.replaceChildren(createMessage(emptyMessage, 'li'));
  } else {
    restaurantListElem.replaceChildren(
      ...pageRestaurants.map(createRestaurantCard)
    );
  }
  renderPagination();
};

const getRestaurantDistanceKm = (restaurant) => {
  const userCoords = getUserCoordinates();
  const coords = extractCoordinates(restaurant);
  if (!userCoords || !coords) {
    return null;
  }
  return getDistanceKm(userCoords, coords);
};

const renderRestaurants = (restaurants) => {
  const withDistance = restaurants.map((restaurant) => ({
    restaurant,
    distanceKm: getRestaurantDistanceKm(restaurant),
  }));

  withDistance.sort((a, b) => {
    if (a.distanceKm !== null || b.distanceKm !== null) {
      const distA = a.distanceKm ?? Infinity;
      const distB = b.distanceKm ?? Infinity;
      if (distA !== distB) {
        return distA - distB;
      }
    }

    return (
      (a.restaurant.city || '').localeCompare(b.restaurant.city || '', 'fi') ||
      getName(a.restaurant).localeCompare(getName(b.restaurant), 'fi')
    );
  });

  listedRestaurants = withDistance.map((item) => item.restaurant);

  renderRestaurantMarkers(listedRestaurants, getFavoriteRestaurantId());

  showPage(1);
};

const fillSelect = (selectElem, values) => {
  const uniqueValues = [...new Set(values.filter(Boolean))];
  uniqueValues.sort((a, b) => a.localeCompare(b, 'fi'));

  for (const value of uniqueValues) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectElem.append(option);
  }
};

export const applyFilters = () => {
  const search = searchElem.value.trim().toLowerCase();

  const filtered = allRestaurants.filter(
    (restaurant) =>
      (search === '' || getName(restaurant).toLowerCase().includes(search)) &&
      (cityElem.value === '' || restaurant.city === cityElem.value) &&
      (providerElem.value === '' ||
        restaurant.company === providerElem.value) &&
      (!onlyFavorites || isRestaurantFavorite(restaurant))
  );

  renderRestaurants(filtered);
};

export const loadRestaurants = async () => {
  try {
    const data = await fetchData('restaurants');
    allRestaurants = Array.isArray(data) ? data : data.restaurants || [];

    fillSelect(
      cityElem,
      allRestaurants.map((restaurant) => restaurant.city)
    );
    fillSelect(
      providerElem,
      allRestaurants.map((restaurant) => restaurant.company)
    );

    applyFilters();
  } catch (error) {
    console.error('Failed to load restaurants:', error);
    restaurantListElem.replaceChildren(
      createMessage(
        'Ravintoloita ei voitu ladata. Tarkista verkkoyhteys tai VPN.',
        'li'
      )
    );
  }
};

export const initRestaurantEvents = () => {
  searchElem.addEventListener('input', applyFilters);
  cityElem.addEventListener('change', applyFilters);
  providerElem.addEventListener('change', applyFilters);

  filterFormElem.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });

  filterFormElem.addEventListener('reset', () => setTimeout(applyFilters, 0));

  if (navFavoritesElem) {
    navFavoritesElem.addEventListener('click', (event) => {
      event.preventDefault();
      if (!getCurrentUser()) {
        window.location.hash = '#login';
        return;
      }
      onlyFavorites = !onlyFavorites;
      syncFavoritesNavUI();
      applyFilters();
      document
        .querySelector('#restaurants')
        ?.scrollIntoView({behavior: 'smooth'});
    });
  }

  if (navRestaurantsElem) {
    navRestaurantsElem.addEventListener('click', () => {
      if (onlyFavorites) {
        onlyFavorites = false;
        syncFavoritesNavUI();
        applyFilters();
      }
    });
  }

  onAuthChange((user) => {
    if (!user && onlyFavorites) {
      onlyFavorites = false;
    }
    syncFavoritesNavUI();
    applyFilters();
  });
};
