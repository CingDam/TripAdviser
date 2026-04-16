# NestJS 트랜잭션 규칙

## 언제 트랜잭션을 써야 하나

여러 테이블에 쓰기(INSERT/UPDATE/DELETE)가 연달아 일어나고,
**하나라도 실패하면 나머지도 롤백되어야** 하는 경우에 항상 사용한다.

| 상황 | 트랜잭션 필요 여부 |
|---|---|
| 단일 엔티티 save/delete | 불필요 |
| 부모 저장 → 자식 여러 건 삽입 | **필요** |
| 조회 후 다른 테이블 업데이트 | **필요** |
| find-or-create (없으면 생성 후 FK로 연결) | **필요** |

---

## 사용 방법 — `manager.transaction`

TypeORM의 `EntityManager` 트랜잭션을 사용한다.
Repository에 직접 접근하지 않고, 콜백으로 받은 `em`(EntityManager)만 사용한다.

```typescript
// O — EntityManager 트랜잭션
async saveFull(userNum: number, dto: SavePlanDto): Promise<Plan> {
  return this.planRepo.manager.transaction(async (em) => {
    const plan = em.create(Plan, { ... });
    const saved = await em.save(Plan, plan);

    const children = dto.items.map((item) => em.create(Child, { plan: saved, ...item }));
    await em.save(Child, children);

    return saved;
  });
}

// X — 트랜잭션 없이 여러 repo를 순서대로 save
const plan = await this.planRepo.save(...);
await this.dayPlanRepo.save(...); // plan 저장 성공해도 여기서 실패하면 불일치 발생
```

---

## find-or-create 패턴

트랜잭션 안에서 중복 생성을 막으면서 엔티티를 조회하거나 새로 만들어야 할 때:

```typescript
// O — 트랜잭션 내 find-or-create
private async resolveCity(em: EntityManager, dto: SavePlanDto) {
  if (dto.cityNum) return { cityNum: dto.cityNum };
  if (!dto.cityName || !dto.country) return null;

  const existing = await em.findOne(City, {
    where: { cityName: dto.cityName, country: dto.country },
  });
  if (existing) return { cityNum: existing.cityNum };

  const created = await em.save(City, em.create(City, {
    cityName: dto.cityName,
    country: dto.country,
    lat: dto.cityLat ?? 0,
    lng: dto.cityLng ?? 0,
  }));
  return { cityNum: created.cityNum };
}
```

---

## 주의사항

- 트랜잭션 콜백 안에서는 `this.xxxRepo`를 쓰지 않는다 — 별도 커넥션이라 트랜잭션에 포함되지 않음
- 트랜잭션 콜백 안에서는 반드시 `em.findOne`, `em.save`, `em.delete`, `em.create` 사용
- 트랜잭션 중 예외를 던지면 자동 롤백된다 — 별도 rollback 호출 불필요
- NestJS 내장 예외(`NotFoundException`, `ForbiddenException` 등)도 트랜잭션 롤백을 트리거한다
