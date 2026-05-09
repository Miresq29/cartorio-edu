const fs = require('fs');
const content = Buffer.from(require('fs').readFileSync(__dirname + '/training_b64.txt', 'utf8').trim(), 'base64').toString('utf8');
fs.writeFileSync('C:/Users/miria/cartorio-edu/frontend/src/features/Training/TrainingView.tsx', content, 'utf8');
console.log('Escrito! Linhas:', content.split('\n').length);