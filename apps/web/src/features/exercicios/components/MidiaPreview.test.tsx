import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TIPO_MIDIA } from '@amfit/shared';
import { MidiaPreview } from './MidiaPreview';

describe('MidiaPreview', () => {
  it('exibe um placeholder acessivel quando url esta ausente', () => {
    render(<MidiaPreview url={null} tipo={null} alt="Supino reto" />);

    expect(screen.getByRole('img', { name: 'Supino reto sem mídia' })).toBeInTheDocument();
  });

  it('exibe um placeholder acessivel quando tipo esta ausente', () => {
    render(<MidiaPreview url="https://cdn.amfit.app/foto.jpg" tipo={null} alt="Supino reto" />);

    expect(screen.getByRole('img', { name: 'Supino reto sem mídia' })).toBeInTheDocument();
  });

  it('renderiza um elemento <video> quando o tipo e VIDEO', () => {
    const { container } = render(
      <MidiaPreview
        url="https://cdn.amfit.app/video.mp4"
        tipo={TIPO_MIDIA.VIDEO}
        alt="Supino reto"
        controls
      />,
    );

    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', 'https://cdn.amfit.app/video.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('aria-label', 'Supino reto');
  });

  it('renderiza um elemento <img> quando o tipo e IMAGEM', () => {
    render(
      <MidiaPreview url="https://cdn.amfit.app/foto.jpg" tipo={TIPO_MIDIA.IMAGEM} alt="Supino reto" />,
    );

    const img = screen.getByAltText('Supino reto');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://cdn.amfit.app/foto.jpg');
  });

  it('renderiza um elemento <img> quando o tipo e GIF', () => {
    render(
      <MidiaPreview url="https://cdn.amfit.app/anim.gif" tipo={TIPO_MIDIA.GIF} alt="Supino reto" />,
    );

    const img = screen.getByAltText('Supino reto');
    expect(img.tagName).toBe('IMG');
  });
});
