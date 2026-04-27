'use client';

import { useState } from 'react';
import { X, ChevronDown, MapPin, ImagePlus } from 'lucide-react';
import { nestApi } from '@/config/api.config';
import { useSnackbar } from '@/components/common/SnackbarProvider';
import Button from '@/components/common/Button';

export interface CityOption {
  cityNum: number;
  cityName: string;
  country: string;
  imageUrl: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cities: CityOption[];
  onPosted: () => void;
}

export default function CommunityWriteModal({ isOpen, onClose, cities, onPosted }: Props) {
  const { show } = useSnackbar();
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalCityNum, setModalCityNum] = useState<number | null>(null);
  const [modalImages, setModalImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setModalTitle('');
    setModalContent('');
    setModalCityNum(null);
    setModalImages([]);
    onClose();
  };

  const handleSubmit = async () => {
    if (!modalTitle.trim() || !modalContent.trim()) {
      show('제목과 내용을 입력해주세요', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await nestApi.post<{ communityNum: number }>('/community', {
        title: modalTitle.trim(),
        content: modalContent.trim(),
        ...(modalCityNum !== null && { cityNum: modalCityNum }),
      });
      if (modalImages.length > 0) {
        const form = new FormData();
        modalImages.forEach((file) => form.append('images', file));
        await nestApi.post(`/community/${res.data.communityNum}/images`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      show('게시글이 등록되었습니다', 'success');
      resetAndClose();
      onPosted();
    } catch {
      show('등록에 실패했습니다', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setModalImages((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={resetAndClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#2c2c2e] rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white/90">새 글 작성</h2>
          <button
            type="button"
            onClick={resetAndClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-white/30 dark:hover:text-white/70 dark:hover:bg-white/8 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 dark:text-white/40">제목</label>
          <input
            type="text"
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            maxLength={100}
            className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-rose-500/30 transition-all"
          />
        </div>

        {cities.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 dark:text-white/40">
              도시 <span className="font-normal text-gray-400 dark:text-white/25">(선택사항)</span>
            </label>
            <div className="relative">
              <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 pointer-events-none" />
              <select
                value={modalCityNum ?? ''}
                onChange={(e) => setModalCityNum(e.target.value ? Number(e.target.value) : null)}
                className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white/90 outline-none focus:ring-2 focus:ring-rose-500/30 transition-all appearance-none cursor-pointer"
              >
                <option value="">도시 선택 안 함</option>
                {cities.map((city) => (
                  <option key={city.cityNum} value={city.cityNum}>
                    {city.cityName} · {city.country}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-500 dark:text-white/40">내용</label>
          <textarea
            value={modalContent}
            onChange={(e) => setModalContent(e.target.value)}
            placeholder="여행 이야기를 자유롭게 작성해보세요"
            rows={6}
            className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-white/8 text-gray-900 dark:text-white/90 placeholder:text-gray-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-rose-500/30 transition-all resize-none leading-relaxed"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500 dark:text-white/40">
            이미지 <span className="font-normal text-gray-400 dark:text-white/25">(선택사항 · 최대 5장 · 각 5MB 이하)</span>
          </label>

          {modalImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {modalImages.map((file, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 dark:border-white/8 group flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setModalImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {modalImages.length < 5 && (
            <label className="flex items-center gap-2 w-fit px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-white/15 text-xs text-gray-500 dark:text-white/35 hover:border-rose-400 hover:text-rose-500 dark:hover:border-rose-500/40 dark:hover:text-rose-400 transition-all cursor-pointer">
              <ImagePlus size={14} />
              사진 추가
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={resetAndClose}>취소</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? '등록 중...' : '등록'}
          </Button>
        </div>
      </div>
    </div>
  );
}
