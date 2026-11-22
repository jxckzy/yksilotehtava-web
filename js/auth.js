import {fetchData, requestJSON} from './api.js';

const TOKEN_KEY = 'lounaslista_token';
const LOGIN_ENDPOINT = 'auth/login';

const loginForm = document.querySelector('#login form');
const registerForm = document.querySelector('#register form');
const loginUsernameInput = document.querySelector('#login-username');
const loginPasswordInput = document.querySelector('#login-password');
const registerUsernameInput = document.querySelector('#register-username');
const registerEmailInput = document.querySelector('#register-email');
const registerPasswordInput = document.querySelector('#register-password');
const headerLoginLink = document.querySelector('.site-header .button-orange');

let currentUser = null;
const listeners = new Set();

const notifyListeners = () => {
  for (const listener of listeners) {
    listener(currentUser);
  }
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getCurrentUser = () => currentUser;
export const getFavoriteRestaurantId = () =>
  currentUser?.favouriteRestaurant || null;

export const setCurrentUser = (user) => {
  currentUser = user;
  notifyListeners();
};

export const onAuthChange = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const updateFavoriteRestaurant = async (restaurantId) => {
  const token = getToken();
  if (!token || !currentUser) {
    throw new Error('Not authenticated');
  }

  const nextValue = restaurantId || null;
  const response = await requestJSON('users', {
    method: 'PUT',
    token,
    body: {favouriteRestaurant: nextValue},
  });

  const updatedData = response?.data || {};
  currentUser = {
    ...currentUser,
    ...updatedData,
    favouriteRestaurant:
      updatedData.favouriteRestaurant !== undefined
        ? updatedData.favouriteRestaurant
        : nextValue,
  };

  notifyListeners();
  return currentUser;
};

const extractToken = (payload) =>
  payload?.token || payload?.data?.token || payload?.accessToken || null;

const setStatusMessage = (form, text, isError = false, isWarning = false) => {
  let statusElem = form.querySelector('.form-status');
  if (!statusElem) {
    statusElem = document.createElement('p');
    statusElem.className = 'form-status message';
    form.append(statusElem);
  }
  statusElem.textContent = text;
  statusElem.style.color = isError
    ? '#9e2a2b'
    : isWarning
      ? '#8a5a12'
      : 'var(--green)';
};

const closeModalIfOpen = (modalId) => {
  if (window.location.hash === modalId) {
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
  }
};

const updateHeaderUI = () => {
  if (!headerLoginLink) {
    return;
  }

  if (currentUser) {
    headerLoginLink.textContent = `Kirjaudu ulos (${currentUser.username})`;
    headerLoginLink.href = '#logout';
  } else {
    headerLoginLink.textContent = 'Kirjaudu';
    headerLoginLink.href = '#login';
  }
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  updateHeaderUI();
  notifyListeners();
};

export const fetchCurrentUser = async () => {
  const token = getToken();
  if (!token) {
    currentUser = null;
    updateHeaderUI();
    notifyListeners();
    return null;
  }

  try {
    const user = await fetchData('users/token', token);
    currentUser = user?.data || user;
    updateHeaderUI();
    notifyListeners();
    return currentUser;
  } catch (error) {
    console.warn('Stored token invalid or expired:', error);
    logout();
    return null;
  }
};

const handleLoginSubmit = async (event) => {
  event.preventDefault();
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  if (!username || !password) {
    setStatusMessage(loginForm, 'Täytä käyttäjätunnus ja salasana.', true);
    return;
  }

  setStatusMessage(loginForm, 'Kirjaudutaan sisään...');

  try {
    const result = await requestJSON(LOGIN_ENDPOINT, {
      method: 'POST',
      body: {username, password},
    });

    const token = extractToken(result);
    if (!token) {
      throw new Error('Token missing from login response');
    }

    localStorage.setItem(TOKEN_KEY, token);
    await fetchCurrentUser();
    loginForm.reset();
    setStatusMessage(loginForm, 'Kirjautuminen onnistui!');
    closeModalIfOpen('#login');
  } catch (error) {
    console.error('Login failed:', error);
    setStatusMessage(
      loginForm,
      error.message || 'Kirjautuminen epäonnistui. Tarkista tunnukset.',
      true
    );
  }
};

const handleRegisterSubmit = async (event) => {
  event.preventDefault();
  const username = registerUsernameInput.value.trim();
  const email = registerEmailInput.value.trim();
  const password = registerPasswordInput.value;

  if (!username || !email || !password) {
    setStatusMessage(registerForm, 'Täytä kaikki kentät.', true);
    return;
  }

  setStatusMessage(registerForm, 'Tarkistetaan käyttäjätunnusta...');

  try {
    const availability = await fetchData(
      `users/available/${encodeURIComponent(username)}`
    );
    if (availability && availability.available === false) {
      setStatusMessage(registerForm, 'Käyttäjätunnus on jo varattu.', true);
      return;
    }

    setStatusMessage(registerForm, 'Luodaan tiliä...');
    const created = await requestJSON('users', {
      method: 'POST',
      body: {username, email, password},
    });

    registerForm.reset();
    const activationNote = created?.data?.activationUrl
      ? ' Tarkista aktivointilinkki tilin aktivoimiseksi.'
      : ' Voit nyt kirjautua sisään.';
    setStatusMessage(
      registerForm,
      (created?.message || 'Tili luotu!') + activationNote
    );
  } catch (error) {
    console.error('Registration failed:', error);

    const smtpFailure =
      error.status === 535 ||
      /535|smtp|authentication failed|authori[sz]ation failed/i.test(
        `${error.message || ''} ${error.data?.message || ''}`
      );

    if (smtpFailure) {
      setStatusMessage(
        registerForm,
        'Tili luotiin, mutta aktivointisähköpostin lähetys epäonnistui (sähköpostipalvelimen autentikointivirhe 535). Kokeile kirjautumista tai ota yhteyttä palvelun ylläpitoon.',
        false,
        true
      );
      return;
    }

    setStatusMessage(
      registerForm,
      error.message || 'Rekisteröinti epäonnistui.',
      true
    );
  }
};

export const initAuth = async () => {
  updateHeaderUI();

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
  if (headerLoginLink) {
    headerLoginLink.addEventListener('click', (event) => {
      if (currentUser) {
        event.preventDefault();
        logout();
      }
    });
  }

  await fetchCurrentUser();
};
