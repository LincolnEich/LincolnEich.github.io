const sound = new Howl({
  src: ['Assets/Audio/ralsei-scream.mp3'],
  volume: 1.0
});

document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('button');

  if (button) {
    button.addEventListener('click', () => {
      sound.play();
    });
  }
});

//window.dispatchEvent(new Event('resize'));