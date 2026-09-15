export function initLazyVideos() {
  // Share the supplied footer snippet's guard if it is already installed.
  if (window.__bvLazyVideosStarted) return;
  window.__bvLazyVideosStarted = true;

  function start() {
    const videos = document.querySelectorAll<HTMLVideoElement>('video[data-bv-lazy-video="true"]');

    function loadVideo(video: HTMLVideoElement) {
      if (video.dataset.bvVideoLoaded === 'true') return;
      video.dataset.bvVideoLoaded = 'true';
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;

      const directSource = video.getAttribute('data-src');
      if (directSource) {
        video.src = directSource;
        video.removeAttribute('data-src');
      }
      video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach(source => {
        source.src = source.getAttribute('data-src')!;
        source.removeAttribute('data-src');
      });

      video.load();
      const playback = video.play();
      if (playback && typeof playback.catch === 'function') {
        playback.catch(() => {
          // Allow manual playback if the browser blocks autoplay.
          video.controls = true;
        });
      }
    }

    if (!('IntersectionObserver' in window)) {
      videos.forEach(loadVideo);
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        loadVideo(entry.target as HTMLVideoElement);
      });
    }, { rootMargin: '300px 0px', threshold: 0 });

    videos.forEach(video => observer.observe(video));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
