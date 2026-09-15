(function () {
  if (window.__bvLazyVideosStarted) return;
  window.__bvLazyVideosStarted = true;

  function start() {
    const videos = Array.from(document.querySelectorAll('video'));
    const visible = new Set<HTMLVideoElement>();

    function loadSources(video: HTMLVideoElement) {
      if (video.getAttribute('data-bv-lazy-video') !== 'true' ||
          video.dataset.bvVideoLoaded === 'true') return;
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

      video.preload = 'auto';
      video.load();
    }

    function handlePlaybackError(video: HTMLVideoElement, error: unknown) {
      // Leaving the viewport can cancel a pending play request normally.
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
      video.controls = true;
    }

    function playVisible(video: HTMLVideoElement) {
      if (document.hidden || !visible.has(video)) return;
      loadSources(video);
      try {
        const playback = video.play();
        if (playback && typeof playback.catch === 'function') {
          playback.catch(error => handlePlaybackError(video, error));
        }
      } catch (error) {
        handlePlaybackError(video, error);
      }
    }

    // Preserve the visibility-based playback previously supplied by Auto Video.
    videos.forEach(video => { video.autoplay = false; });

    if (!('IntersectionObserver' in window)) {
      videos.forEach(video => {
        visible.add(video);
        playVisible(video);
      });
      return;
    }

    const preloadObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        preloadObserver.unobserve(entry.target);
        loadSources(entry.target as HTMLVideoElement);
      });
    }, { rootMargin: '300px 0px', threshold: 0 });

    const playbackObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting && entry.intersectionRatio > 0) {
          visible.add(video);
          playVisible(video);
        } else {
          visible.delete(video);
          video.pause();
        }
      });
    }, { threshold: 0 });

    videos.forEach(video => {
      if (video.getAttribute('data-bv-lazy-video') === 'true') {
        preloadObserver.observe(video);
      }
      playbackObserver.observe(video);
    });

    document.addEventListener('visibilitychange', () => {
      videos.forEach(video => {
        if (document.hidden) video.pause();
        else playVisible(video);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
