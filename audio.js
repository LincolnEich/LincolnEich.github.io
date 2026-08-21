/* -------------------------------------------------------------------------- */
/*                                    Audio                                   */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                  Wavy Text                                 */
/* -------------------------------------------------------------------------- */

function setWavyText(element) {
    element.innerHTML = element.innerText
        .split("")
        .map(letter => `<span>${letter === " " ? "&nbsp;" : letter}</span>`)
        .join("");

    Array.from(element.children).forEach((span, index) => {
        setTimeout(() => {
        span.classList.add("wavy");
        span.style.animationPlayState = "running";
        span.getAnimations().forEach((anim) => {
            if (anim.animationName === 'wavy') {
                if (!document.hidden) {
                  anim.cancel();
                  setTimeout(() => {
                    anim.play();
                  }, 750);
                }
            }
        });
        }, index * 200);
    });
}

function waveText(element) {
    Array.from(element.children).forEach((span, index) => {
      if (!document.hidden) {
        setTimeout(() => {
        span.getAnimations().forEach((anim) => {
            if (anim.animationName === 'wavy') {
                anim.cancel();
                anim.play();
            }
        });
        }, index * 150);
      }
    });
}

const elh1 = document.querySelector('h1')
const elh2 = document.querySelector('h2')

let mytime = 0.01;

function animationLoop() {

  mytime += 0.01;
  
  if ((mytime * 100) % 200 < 1 && !document.hidden) {
    waveText(elh1);
    setTimeout(() => {
        waveText(elh2);
    }, 1600);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      mytime = -0.01;
    }
  });

  requestAnimationFrame(animationLoop);
}

let loadCheck = 0;

window.addEventListener("load", () => {
  loadCheck = 1;
});

document.addEventListener("visibilitychange", () => {
    if (loadCheck == 1) {
      loadCheck = 2;
      setWavyText(elh1);
      setTimeout(() => {
      setWavyText(elh2);
      }, 1600);

      setTimeout(() => {
          requestAnimationFrame(animationLoop);
      }, 1000);
    }
});
