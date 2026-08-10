import { Activity, SPORTS, SportFilter } from "@/lib/types/activity";
import { ActivityCard } from "@/components/activity/activity-card";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";

type DateFilter = {
  key: string;
  label: string;
  day: number;
};

type ActivitiesSectionProps = {
  activities: Activity[];
  dateFilters: DateFilter[];
  selectedDate: string;
  selectedSport: SportFilter;
  myOnly: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  submitting: boolean;
  error: string;
  onSelectDate: (date: string) => void;
  onSelectSport: (sport: SportFilter) => void;
  onSelectActivity: (activity: Activity) => void;
  onPerformAction: (
    path: string,
    method: "POST" | "DELETE",
    message: string,
  ) => void;
  onOpenRating: (activityId: string) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onBrowse: () => void;
  onCreate: () => void;
};

export function ActivitiesSection({
  activities,
  dateFilters,
  selectedDate,
  selectedSport,
  myOnly,
  loading,
  loadingMore,
  hasMore,
  submitting,
  error,
  onSelectDate,
  onSelectSport,
  onSelectActivity,
  onPerformAction,
  onOpenRating,
  onRetry,
  onLoadMore,
  onBrowse,
  onCreate,
}: ActivitiesSectionProps) {
  const dateScroller = useHorizontalDragScroll<HTMLDivElement>();
  const sportScroller = useHorizontalDragScroll<HTMLDivElement>();

  return (
    <section className="matches-section" id="matches">
      <div className="section-title-row match-heading">
        <div>
          <p className="section-kicker">{myOnly ? "MY ACTIVITIES" : "UPCOMING"}</p>
          <h2>{myOnly ? "내가 참여한 모임" : "다가오는 모임"}</h2>
        </div>
        <span className="match-count">{activities.length}개</span>
      </div>

      <div className="filter-row horizontal-drag-scroll" {...dateScroller}>
        <button
          className={`filter-pill ${selectedDate === "전체" ? "active" : ""}`}
          onClick={() => onSelectDate("전체")}
        >
          전체
        </button>
        {dateFilters.map((date) => (
          <button
            key={date.key}
            className={`date-pill ${selectedDate === date.key ? "active" : ""}`}
            onClick={() => onSelectDate(date.key)}
          >
            <span>{date.label}</span>
            <strong>{date.day}</strong>
          </button>
        ))}
      </div>

      <div className="active-filter-row">
        <div
          className="sport-pills horizontal-drag-scroll"
          {...sportScroller}
        >
          {SPORTS.map((sport) => (
            <button
              key={sport}
              className={selectedSport === sport ? "active" : ""}
              onClick={() => onSelectSport(sport)}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={onRetry}>다시 시도</button>
        </div>
      )}

      <div className="match-list">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div className="match-skeleton" key={index} />
          ))
        ) : activities.length > 0 ? (
          activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              submitting={submitting}
              onSelect={onSelectActivity}
              onPerformAction={onPerformAction}
              onOpenRating={onOpenRating}
            />
          ))
        ) : (
          <div className="empty-state">
            <span>🙌</span>
            <h3>{myOnly ? "참여한 모임이 아직 없어요" : "조건에 맞는 모임이 없어요"}</h3>
            <p>
              {myOnly
                ? "마음에 드는 모임에 참가해 보세요."
                : "첫 번째 모임을 열어 친구들을 모아보세요."}
            </p>
            <button onClick={myOnly ? onBrowse : onCreate}>
              {myOnly ? "모임 둘러보기" : "모임 만들기"}
            </button>
          </div>
        )}
      </div>

      {!loading && activities.length > 0 && hasMore && (
        <button
          className="load-more-activities"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "불러오는 중..." : "모임 더 보기"}
        </button>
      )}

      <aside className="safety-note">
        <span>🛡️</span>
        <div>
          <strong>모두가 즐거운 같이해U</strong>
          <p>연락처는 공개하지 말고, 정해진 교내 장소에서 서로를 배려해 주세요.</p>
        </div>
      </aside>
    </section>
  );
}
