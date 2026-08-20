const spawnSound = new Howl({
  src: ['Assets/Audio/Ralsei Splat.mp3'],
  volume: 0.25
});

const open = new Howl({
  src: ['Assets/Audio/Open.mp3'],
  volume: 1.0
});

const close = new Howl({
  src: ['Assets/Audio/Close.mp3'],
  volume: 1.0
});

const slideIn = new Howl({
  src: ['Assets/Audio/Slide In.mp3'],
  volume: 1.0
});

const slideOut = new Howl({
  src: ['Assets/Audio/Slide Out.mp3'],
  volume: 1.0
});

const bgMusic = new Howl({
  src: ['Assets/Audio/Apogamy.mp3'],
  volume: 0.2,
  loop: true
});

document.addEventListener('DOMContentLoaded', () => {

  bgMusic.play();

  /* Fade Out
  bgMusic.on('play', function() {
    const bgmFade = 2000;
    const bgmDuration = bgMusic.duration() * 1000;
    setTimeout(
      function(){
        bgMusic.fade(1, 0, bgmFade);
      }, (bgmDuration - bgmFade)
    );
  });
  */

  const button = document.querySelector('button');

  if (button) {
    button.addEventListener('click', () => {
      spawnSound.play();
      open.play();
    });
  }

});