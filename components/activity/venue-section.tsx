import { Sport } from "@/lib/types/activity";

const VENUE_ITEMS: Array<{
  venue: string;
  sport: Sport;
  icon: string;
  featured?: boolean;
}> = [
  { venue: "대운동장 러닝트랙", sport: "러닝", icon: "🏃", featured: true },
  { venue: "실외농구장", sport: "농구", icon: "🏀", featured: true },
  { venue: "100주년 기념관 농구장", sport: "농구", icon: "🏀", featured: true },
  { venue: "대운동장 잔디구장", sport: "축구", icon: "⚽", featured: true },
  { venue: "실외테니스장", sport: "테니스", icon: "🎾" },
  { venue: "실내테니스장", sport: "테니스", icon: "🎾" },
  { venue: "스쿼시장", sport: "스쿼시", icon: "🎾" },
  { venue: "100주년 기념관 배드민턴장", sport: "배드민턴", icon: "🏸" },
  { venue: "100주년 기념관 배구장", sport: "배구", icon: "🏐" },
  { venue: "족구장", sport: "족구", icon: "🦶" },
];

type VenueSectionProps = {
  venueCounts: Record<string, number>;
  onSelectSport: (sport: Sport) => void;
};

export function VenueSection({ venueCounts, onSelectSport }: VenueSectionProps) {
  return (
    <section className="venue-list-section">
      <div className="section-title-row">
        <div>
          <p className="section-kicker">CAMPUS VENUES</p>
          <h2>장소별 모임</h2>
        </div>
      </div>
      <div className="venue-list">
        {VENUE_ITEMS.map((item) => {
          const count = venueCounts[item.venue] ?? 0;
          return (
            <button
              key={item.venue}
              className={`venue-list-item ${count > 0 ? "has-activities" : ""} ${item.featured ? "featured" : ""}`}
              data-sport={item.sport}
              onClick={() => onSelectSport(item.sport)}
            >
              <span className="venue-list-icon">{item.icon}</span>
              <span className="venue-list-name">{item.venue}</span>
              {item.featured && <span className="venue-list-badge">추천</span>}
              <span className={`venue-list-count ${count > 0 ? "active" : ""}`}>
                {count}개 모임
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
