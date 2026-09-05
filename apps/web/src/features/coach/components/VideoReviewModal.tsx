'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EnviarFeedbackRequestSchema, type EnviarFeedbackRequest, type CoachVideoResponse } from '@amfit/shared';
import { Modal } from '@/features/fichas';
import { useEnviarFeedback } from '../hooks/useEnviarFeedback';

type Props = {
  video: CoachVideoResponse;
  onClose: () => void;
};

export function VideoReviewModal({ video, onClose }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { mutate, isPending } = useEnviarFeedback();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnviarFeedbackRequest>({
    resolver: zodResolver(EnviarFeedbackRequestSchema),
    defaultValues: { texto: '' },
  });

  function onSubmit(values: EnviarFeedbackRequest) {
    setServerError(null);
    mutate(
      { videoId: video.id, payload: values },
      {
        onSuccess: () => onClose(),
        onError: (err) => {
          if (err.response?.status === 409) {
            setServerError('Este vídeo já recebeu feedback.');
            return;
          }
          setServerError('Não foi possível enviar o feedback. Tente novamente.');
        },
      },
    );
  }

  const titulo = video.exercicio_nome
    ? `Vídeo — ${video.exercicio_nome}`
    : `Vídeo de ${video.aluno_nome ?? 'aluno'}`;

  return (
    <Modal open onClose={onClose} title={titulo} size="lg">
      <div className="space-y-4">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- clipe curto do próprio aluno, sem legendas disponíveis */}
        <video
          src={video.video_url}
          controls
          className="w-full rounded-lg bg-black"
          style={{ maxHeight: '60vh' }}
        />

        {video.descricao && (
          <p className="text-sm text-[--color-text-muted]">
            <span className="font-medium text-[--color-text]">Aluno pediu: </span>
            {video.descricao}
          </p>
        )}

        {video.feedback ? (
          <div className="rounded-md border border-[--color-border] bg-[--color-bg-subtle] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[--color-text-muted]">
              Seu feedback
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[--color-text]">
              {video.feedback.texto}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div>
              <label
                htmlFor="texto"
                className="mb-1 block text-sm font-medium text-[--color-text]"
              >
                Feedback pro aluno
              </label>
              <textarea
                id="texto"
                rows={4}
                className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
                {...register('texto')}
              />
              {errors.texto && (
                <p role="alert" className="mt-1 text-xs text-[--color-danger]">
                  {errors.texto.message}
                </p>
              )}
            </div>

            {serverError && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-[--color-danger]"
              >
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="rounded-md bg-[--color-primary] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[--color-primary-hover] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Enviando...' : 'Enviar feedback'}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
