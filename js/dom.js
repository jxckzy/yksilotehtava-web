import {monthNames} from './config.js';

export const createMessage = (text, tagName = 'p') => {
  const elem = document.createElement(tagName);
  elem.className = 'message';
  elem.textContent = text;
  return elem;
};

export const getName = (restaurant) => restaurant.name || 'Nimetön ravintola';

export const formatAddress = (restaurant) => {
  const postalAndCity = [restaurant.postalCode, restaurant.city]
    .filter(Boolean)
    .join(' ');
  return [restaurant.address, postalAndCity].filter(Boolean).join(', ');
};

export const createCourseList = (courses) => {
  const ul = document.createElement('ul');
  ul.className = 'course-list';

  for (const course of courses) {
    const li = document.createElement('li');

    const nameElem = document.createElement('span');
    nameElem.textContent = course.name || 'Annos ilman nimeä';

    if (course.diets) {
      for (const diet of String(course.diets).split(',')) {
        const code = diet.trim();
        if (code === '') {
          continue;
        }
        const badge = document.createElement('span');
        badge.className = 'diet diet-' + code.toLowerCase();
        badge.textContent = code;
        nameElem.append(' ', badge);
      }
    }

    const priceElem = document.createElement('span');
    priceElem.className = 'price';
    priceElem.textContent = course.price || '';

    li.append(nameElem, priceElem);
    ul.append(li);
  }

  return ul;
};

export const parseMenuDate = (text) => {
  const match = /(\d{1,2})\.\s*([a-zäö]+)/i.exec(text || '');
  if (!match) {
    return null;
  }
  const month = monthNames.indexOf(match[2].toLowerCase());
  if (month === -1) {
    return null;
  }

  const now = new Date();
  const date = new Date(now.getFullYear(), month, Number(match[1]));

  const halfYear = 183 * 24 * 60 * 60 * 1000;
  if (date - now > halfYear) {
    date.setFullYear(date.getFullYear() - 1);
  } else if (now - date > halfYear) {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
};

export const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const isSameDay = (a, b) => a.toDateString() === b.toDateString();

export const capitalize = (text) =>
  text.charAt(0).toUpperCase() + text.slice(1);
