
import './services/firebase';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const rootElement = document.getElementById('root');

// Só executa se o root existir e não tenta recarregar se falhar
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />); 
    console.log("✅ Sistema Estabilizado.");
}