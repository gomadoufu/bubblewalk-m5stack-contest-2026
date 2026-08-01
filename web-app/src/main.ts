import './css/app.css';
import { ShowcaseApp } from './app';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('App root is missing');
}

void new ShowcaseApp(root).start();
