export const waitForServiceWorkerUpdate = async (registration, serviceWorker, timeoutMs = 15000) => {
  return new Promise((resolve) => {
    const checkController = () => {
      if (serviceWorker.controller) {
        resolve();
        return;
      }
      serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });
    };

    const onControllerChange = () => {
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve();
    };

    checkController();

    setTimeout(() => {
      serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve();
    }, timeoutMs);
  });
};