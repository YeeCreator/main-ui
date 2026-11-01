import { createApp } from 'vue';
import App from './App.vue';
import 'main-ui/styles.css';
// 视图模板的样式各自独立：只有真正用到该模板的宿主才需要引入，
// 避免把所有模板的样式一次性压给所有宿主。
import '@main-ui/view-minimap/styles.css';
import './styles/demo.css';

createApp(App).mount('#app');
