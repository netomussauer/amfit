// jsdom (ate a v24, instalada neste projeto) ainda nao implementa
// `HTMLDialogElement.prototype.showModal()`/`close()`
// (https://github.com/jsdom/jsdom/issues/3294), apenas a reflexao do
// atributo/IDL `open`. O componente `Modal` desta feature usa <dialog>
// nativo (ver components/Modal.tsx), entao qualquer teste que renderize o
// Modal aberto precisa deste polyfill minimo — sem ele, o efeito que chama
// `dialog.showModal()` lanca `TypeError: dialog.showModal is not a
// function` e quebra o render.
export function polyfillDialogElement(): void {
  if (typeof HTMLDialogElement === 'undefined') return;

  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }

  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
