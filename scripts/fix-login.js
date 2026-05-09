const fs = require('fs');

const loginPath = 'C:/Users/miria/cartorio-edu/frontend/src/features/Auth/LoginView.tsx';
let login = fs.readFileSync(loginPath, 'utf8');
login = login.replace('MJ <span className="text-blue-500">Consultoria</span>', 'Cart\u00f3rio<span className="text-emerald-500">EDU</span>');
login = login.replace(/Seguran[^"]+a/g, 'Educa\u00e7\u00e3o Corporativa Continuada');
login = login.replace(/bg-blue-900\/10/g, 'bg-emerald-900/10');
login = login.replace(/focus:border-blue-600 focus:ring-1 focus:ring-blue-600/g, 'focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600');
login = login.replace('bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-[0.98]', 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 active:scale-[0.98]');
fs.writeFileSync(loginPath, login, 'utf8');
console.log('LoginView OK!');
