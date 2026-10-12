import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('공부의 숲 서버가 살아 있어요');
});

app.listen(3000, () => {
  console.log('서버가 3000번 포트에서 기다리고 있어요.');
});