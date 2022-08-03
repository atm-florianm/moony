game = new Game();

game.renderGalaxyMap();

const turnBtn = document.querySelector('#moony button.turn');
turnBtn.addEventListener('click', () => game.turn());

game.turn();
game.turn();
game.turn();