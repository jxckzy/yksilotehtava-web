import {fetchData} from './api.js';
import {
  capitalize,
  createCourseList,
  createMessage,
  formatAddress,
  getName,
  isSameDay,
  parseMenuDate,
  startOfToday,
} from './dom.js';

const menuElem = document.querySelector('#menu');
const menuTitleElem = document.querySelector('#menu-title');
const menuInfoElem = document.querySelector('#menu-info');
const menuContentElem = document.querySelector('#menu-content');
const viewRadios = document.querySelectorAll('input[name="view"]');

let selectedRestaurant = null;

const getMenuDays = (days) =>
  days.map((day) => ({
    text: capitalize(day.date || 'Päivämäärä puuttuu'),
    date: parseMenuDate(day.date),
    courses: Array.isArray(day.courses) ? day.courses : [],
  }));

const createMenuSection = (title, courses) => {
  const heading = document.createElement('h3');
  heading.textContent = title;
  return [heading, createCourseList(courses)];
};

const renderDailyMenu = (data) => {
  const days = getMenuDays(Array.isArray(data.days) ? data.days : []);
  const today = startOfToday();

  const todayMenu = days.find((day) => day.date && isSameDay(day.date, today));
  if (todayMenu && todayMenu.courses.length > 0) {
    menuContentElem.replaceChildren(
      ...createMenuSection('Tänään · ' + todayMenu.text, todayMenu.courses)
    );
    return;
  }

  if (!days.some((day) => day.date)) {
    const first = days.find((day) => day.courses.length > 0);
    menuContentElem.replaceChildren(
      ...(first
        ? createMenuSection(first.text, first.courses)
        : [createMessage('Tälle päivälle ei ole ruokalistaa.')])
    );
    return;
  }

  const elements = [createMessage('Tänään ei ole ruokalistaa.')];
  const next = days.find((day) => day.date > today && day.courses.length > 0);

  if (next) {
    elements.push(
      ...createMenuSection('Seuraava ruokalista: ' + next.text, next.courses)
    );
  } else {
    const last = [...days].reverse().find((day) => day.courses.length > 0);
    const lastText = last ? ' Viimeisin lista: ' + last.text + '.' : '';
    elements.push(
      createMessage('Uutta ruokalistaa ei ole vielä julkaistu.' + lastText)
    );
  }
  menuContentElem.replaceChildren(...elements);
};

const renderWeeklyMenu = (data) => {
  if (!Array.isArray(data.days) || data.days.length === 0) {
    menuContentElem.replaceChildren(
      createMessage('Tälle viikolle ei ole ruokalistaa.')
    );
    return;
  }

  const days = getMenuDays(data.days);
  const today = startOfToday();

  const heading = document.createElement('h3');
  heading.textContent = 'Viikon ruokalista';
  const elements = [heading];

  const datedDays = days.filter((day) => day.date);
  if (datedDays.length > 0 && datedDays.every((day) => day.date < today)) {
    elements.push(
      createMessage(
        'Uutta ruokalistaa ei ole vielä julkaistu. Alla on vanha lista.'
      )
    );
  }

  let openIndex = days.findIndex((day) => day.date && day.date >= today);
  if (openIndex === -1) {
    openIndex = 0;
  }

  days.forEach((day, index) => {
    const details = document.createElement('details');
    details.open = index === openIndex;
    if (day.date && day.date < today) {
      details.classList.add('past-day');
    }

    const summary = document.createElement('summary');
    summary.textContent = day.text;

    const content =
      day.courses.length > 0
        ? createCourseList(day.courses)
        : createMessage('Ei ruokalistaa.');

    details.append(summary, content);
    elements.push(details);
  });

  menuContentElem.replaceChildren(...elements);
};

export const showMenu = async () => {
  if (!selectedRestaurant) {
    return;
  }

  const restaurant = selectedRestaurant;
  const view = document.querySelector('input[name="view"]:checked').value;

  menuContentElem.replaceChildren(createMessage('Ladataan ruokalistaa...'));

  const isOutdated = () =>
    restaurant !== selectedRestaurant ||
    view !== document.querySelector('input[name="view"]:checked').value;

  try {
    const id = encodeURIComponent(restaurant._id);
    const data = await fetchData(`restaurants/weekly/${id}/fi`);

    if (isOutdated()) {
      return;
    }

    if (view === 'daily') {
      renderDailyMenu(data);
    } else {
      renderWeeklyMenu(data);
    }
  } catch (error) {
    if (isOutdated()) {
      return;
    }
    console.error('Failed to load menu:', error);

    const text =
      error.status === 404
        ? 'Tälle ravintolalle ei löytynyt ruokalistaa.'
        : 'Ruokalistaa ei voitu ladata.';
    menuContentElem.replaceChildren(createMessage(text));
  }
};

export const selectRestaurant = (restaurant, card) => {
  selectedRestaurant = restaurant;

  document.querySelector('.restaurant.selected')?.classList.remove('selected');
  card.classList.add('selected');

  menuTitleElem.textContent = getName(restaurant);
  menuInfoElem.textContent = [formatAddress(restaurant), restaurant.company]
    .filter(Boolean)
    .join(' · ');

  showMenu();
  menuElem.scrollIntoView({behavior: 'smooth', block: 'nearest'});
};

export const getSelectedRestaurant = () => selectedRestaurant;

export const initMenuEvents = () => {
  for (const radio of viewRadios) {
    radio.addEventListener('change', showMenu);
  }
};
