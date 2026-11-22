import {fetchData, requestJSON} from './api.js';
import {apiURL} from './config.js';

const TOKEN_KEY = 'lounaslista_token';
const uploadsBaseURL = apiURL.replace(/\/api\/v1\/?$/, '/uploads/');

const logoutBtn = document.querySelector('.site-header .button-orange');
const avatarBox = document.querySelector('#avatar');
const avatarInitials = document.querySelector('#avatar-initials');
const avatarForm = document.querySelector('#avatar-form');
const avatarFileInput = document.querySelector('#avatar-file');
const avatarMessage = document.querySelector('#avatar-message');

const profileForm = document.querySelector('#profile-form');
const usernameInput = document.querySelector('#profile-username');
const emailInput = document.querySelector('#profile-email');
const favoriteSelect = document.querySelector('#profile-favorite');
const passwordInput = document.querySelector('#profile-password');
const passwordAgainInput = document.querySelector('#profile-password-again');
const profileMessage = document.querySelector('#profile-message');

const getToken = () => localStorage.getItem(TOKEN_KEY);

const setMessage = (elem, text, isError = false) => {
  elem.textContent = text;
  elem.style.color = isError ? '#9e2a2b' : 'var(--green)';
};

const resolveAvatarURL = (avatar) => {
  if (!avatar) {
    return null;
  }
  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }
  return uploadsBaseURL + avatar.replace(/^\/+/, '');
};

const renderAvatar = (user) => {
  const initial = (user?.username || 'K').charAt(0).toUpperCase();
  avatarInitials.textContent = initial;

  const url = resolveAvatarURL(user?.avatar);
  if (!url) {
    avatarBox.querySelector('img')?.remove();
    avatarInitials.hidden = false;
    return;
  }

  let img = avatarBox.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = 'Käyttäjän profiilikuva';
    avatarBox.append(img);
  }
  img.src = url;
  avatarInitials.hidden = true;
};

const loadRestaurantOptions = async () => {
  try {
    const data = await fetchData('restaurants');
    const restaurants = Array.isArray(data) ? data : data.restaurants || [];

    restaurants.sort(
      (a, b) =>
        (a.city || '').localeCompare(b.city || '', 'fi') ||
        (a.name || '').localeCompare(b.name || '', 'fi')
    );

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Ei valittu';

    const options = restaurants.map((restaurant) => {
      const option = document.createElement('option');
      option.value = restaurant._id;
      option.textContent = restaurant.city
        ? `${restaurant.name} (${restaurant.city})`
        : restaurant.name;
      return option;
    });

    favoriteSelect.replaceChildren(defaultOption, ...options);
  } catch (error) {
    console.error('Failed to load restaurants for favorite select:', error);
  }
};

const loadUserProfile = async () => {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html#login';
    return;
  }

  try {
    const response = await fetchData('users/token', token);
    const user = response?.data || response;

    usernameInput.value = user.username || '';
    emailInput.value = user.email || '';
    favoriteSelect.value = user.favouriteRestaurant || '';
    renderAvatar(user);
  } catch (error) {
    console.error('Failed to load user profile:', error);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = 'index.html#login';
  }
};

const handleAvatarSubmit = async (event) => {
  event.preventDefault();
  const token = getToken();
  const file = avatarFileInput.files?.[0];

  if (!token || !file) {
    setMessage(avatarMessage, 'Valitse kuvatiedosto ensin.', true);
    return;
  }

  setMessage(avatarMessage, 'Ladataan kuvaa...');

  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const result = await requestJSON('users/avatar', {
      method: 'POST',
      body: formData,
      token,
    });

    const updatedAvatar = result?.data?.avatar;
    renderAvatar({
      username: usernameInput.value,
      avatar: updatedAvatar,
    });

    avatarForm.reset();
    setMessage(avatarMessage, result?.message || 'Profiilikuva päivitetty!');
  } catch (error) {
    console.error('Avatar upload failed:', error);
    setMessage(
      avatarMessage,
      error.message || 'Kuvan lataus epäonnistui.',
      true
    );
  }
};

const handleProfileSubmit = async (event) => {
  event.preventDefault();
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html#login';
    return;
  }

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const passwordAgain = passwordAgainInput.value;
  const favouriteRestaurant = favoriteSelect.value || null;

  if (!username || !email) {
    setMessage(profileMessage, 'Käyttäjätunnus ja sähköposti vaaditaan.', true);
    return;
  }

  if (password !== passwordAgain) {
    setMessage(profileMessage, 'Salasanat eivät täsmää.', true);
    return;
  }

  const payload = {
    username,
    email,
    favouriteRestaurant,
  };

  if (password) {
    payload.password = password;
  }

  setMessage(profileMessage, 'Tallennetaan muutoksia...');

  try {
    const result = await requestJSON('users', {
      method: 'PUT',
      body: payload,
      token,
    });

    passwordInput.value = '';
    passwordAgainInput.value = '';
    renderAvatar({
      username: result?.data?.username || username,
      avatar: result?.data?.avatar,
    });
    setMessage(profileMessage, result?.message || 'Tiedot päivitetty!');
  } catch (error) {
    console.error('Profile update failed:', error);
    setMessage(
      profileMessage,
      error.message || 'Tietojen päivitys epäonnistui.',
      true
    );
  }
};

if (logoutBtn) {
  logoutBtn.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = 'index.html';
  });
}

avatarForm.addEventListener('submit', handleAvatarSubmit);
profileForm.addEventListener('submit', handleProfileSubmit);

await loadRestaurantOptions();
await loadUserProfile();
