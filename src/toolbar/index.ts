import type { MilkdownPlugin } from '@milkdown/ctx';
import { toolbarView } from './view';
import './toolbar.css';

export const toolbarPlugin: MilkdownPlugin[] = [
  toolbarView,
].flat();
