'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'Planit은 무료로 사용할 수 있나요?',
    a: '기본 기능은 무료로 제공됩니다. 일정 저장, AI 자동 정렬, 지도 검색 모두 무료로 이용하실 수 있어요. 추후 프리미엄 기능이 추가될 예정입니다.',
  },
  {
    q: 'AI 자동 정렬은 어떻게 작동하나요?',
    a: '선택하신 장소들의 위치 좌표를 분석해 이동 거리를 최소화하는 최적 동선을 계산합니다. 관광지를 기준으로 주변 식당과 카페를 그룹핑해 하루 일정을 자연스럽게 구성해드려요.',
  },
  {
    q: '일정을 저장하고 공유할 수 있나요?',
    a: '현재는 로컬 상태로 관리되며, 로그인 기능 출시 후 일정 저장 및 공유 기능이 제공될 예정입니다.',
  },
  {
    q: '어떤 나라/도시를 지원하나요?',
    a: 'Google Maps가 지원하는 전 세계 모든 도시를 검색하고 일정을 만들 수 있어요. 검색창에 도시 이름을 입력하면 해당 지역의 관광지, 식당, 카페 등을 바로 불러옵니다.',
  },
  {
    q: '모바일에서도 사용할 수 있나요?',
    a: '현재는 PC 환경에 최적화되어 있습니다. 모바일 반응형은 추후 업데이트 예정이에요.',
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4">

        {/* 섹션 헤더 */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-indigo-600 mb-2">FAQ</p>
          <h2 className="text-3xl font-extrabold text-gray-900">자주 묻는 질문</h2>
          <p className="text-gray-500 mt-2">궁금한 점이 있으시면 아래에서 확인해보세요</p>
        </div>

        {/* 아코디언 */}
        <div className="flex flex-col gap-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border transition-all overflow-hidden
                  ${isOpen ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                >
                  <span className={`text-sm font-semibold ${isOpen ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : 'text-gray-400'}`}
                  />
                </button>

                {/* 답변 — 높이 애니메이션 */}
                <div
                  className={`px-5 text-sm text-gray-600 leading-relaxed transition-all duration-200 ease-in-out overflow-hidden
                    ${isOpen ? 'max-h-40 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  {faq.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
