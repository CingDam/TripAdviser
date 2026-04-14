# CRUD 자동 생성 규칙

새 도메인(기능 모듈)을 추가할 때 아래 순서와 패턴을 그대로 따른다.
"CRUD를 만들어줘" 요청이 오면 이 파일의 순서대로 생성한다.

---

## 생성 순서

```
1. Entity          server/src/{feature}/entities/{feature}.entity.ts
2. DTO             server/src/{feature}/dto/create-{feature}.dto.ts
                   server/src/{feature}/dto/update-{feature}.dto.ts
3. Service         server/src/{feature}/{{feature}.service.ts
4. Controller      server/src/{feature}/{feature}.controller.ts
5. Module          server/src/{feature}/{feature}.module.ts
6. AppModule 등록  server/src/app.module.ts — imports 배열에 추가
7. 프론트 SC       client/src/app/(main)/{feature}/page.tsx
8. 프론트 CC       client/src/components/{feature}/{Feature}Client.tsx
```

---

## REST 엔드포인트 규약

| 동작        | 메서드   | URL                      | Guard   | 설명                |
|------------|---------|--------------------------|---------|---------------------|
| 목록        | GET     | /api/{feature}           | 선택     | 페이지네이션 시 `?page=1&limit=20` |
| 단건 조회   | GET     | /api/{feature}/:id       | 선택     | 비공개면 JWT 필요   |
| 생성        | POST    | /api/{feature}           | JWT 필수 | 201 반환            |
| 수정        | PATCH   | /api/{feature}/:id       | JWT 필수 | 부분 업데이트 (PUT 사용 X) |
| 삭제        | DELETE  | /api/{feature}/:id       | JWT 필수 | 204 or 200          |
| 서브리소스  | POST    | /api/{feature}/:id/{sub} | JWT 필수 | ex) 좋아요, 댓글   |

```typescript
// X — PUT은 전체 교체 의미 → 부분 수정에 사용 금지
@Put(':id') update(...)

// O — PATCH는 부분 수정
@Patch(':id') update(...)
```

---

## Entity 패턴

```typescript
@Entity('tb_{feature}')
export class {Feature} {
  @PrimaryGeneratedColumn({ name: '{feature}_num' })
  {feature}Num: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_num' })
  user: User;

  // nullable 컬럼은 반드시 type 명시 (TypeORM 리플렉션 오류 방지)
  @Column({ type: 'varchar', length: 100, nullable: true })
  someField: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

## DTO 패턴

```typescript
// create-{feature}.dto.ts
export class Create{Feature}Dto {
  @IsString()
  @Length(1, 100)
  title: string;

  @IsOptional()
  @IsNumber()
  cityNum?: number;
}

// update-{feature}.dto.ts — 모든 필드 Optional
export class Update{Feature}Dto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  title?: string;
}
```

---

## Service 패턴

```typescript
@Injectable()
export class {Feature}Service {
  constructor(
    @InjectRepository({Feature})
    private readonly {feature}Repo: Repository<{Feature}>,
  ) {}

  findAll(): Promise<{Feature}[]> {
    return this.{feature}Repo.find({
      relations: ['user', 'city'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<{Feature}> {
    const item = await this.{feature}Repo.findOne({
      where: { {feature}Num: id },
      // 소유자 검사가 필요하면 반드시 'user' 포함
      relations: ['user', 'city'],
    });
    if (!item) throw new NotFoundException('{리소스명}을 찾을 수 없습니다');
    return item;
  }

  async create(userNum: number, dto: Create{Feature}Dto): Promise<{Feature}> {
    const item = this.{feature}Repo.create({ user: { userNum }, ...dto });
    return this.{feature}Repo.save(item);
  }

  async update(id: number, userNum: number, dto: Update{Feature}Dto): Promise<{Feature}> {
    const item = await this.{feature}Repo.findOne({
      where: { {feature}Num: id },
      relations: ['user'],
    });
    if (!item) throw new NotFoundException('{리소스명}을 찾을 수 없습니다');
    if (item.user.userNum !== userNum) throw new ForbiddenException('수정 권한이 없습니다');
    Object.assign(item, dto);
    return this.{feature}Repo.save(item);
  }

  async remove(id: number, userNum: number): Promise<void> {
    const item = await this.{feature}Repo.findOne({
      where: { {feature}Num: id },
      relations: ['user'],
    });
    if (!item) throw new NotFoundException('{리소스명}을 찾을 수 없습니다');
    if (item.user.userNum !== userNum) throw new ForbiddenException('삭제 권한이 없습니다');
    await this.{feature}Repo.remove(item);
  }
}
```

---

## Controller 패턴

```typescript
interface AuthRequest { user: { userNum: number }; }

@Controller('{feature}')
@UseGuards(AuthGuard('jwt'))          // 전체 인증이 필요하면 클래스에 적용
export class {Feature}Controller {
  constructor(private readonly {feature}Service: {Feature}Service) {}

  @Get()
  findAll() { return this.{feature}Service.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.{feature}Service.findOne(id, req.user.userNum);
  }

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: Create{Feature}Dto) {
    return this.{feature}Service.create(req.user.userNum, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthRequest,
    @Body() dto: Update{Feature}Dto,
  ) {
    return this.{feature}Service.update(id, req.user.userNum, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.{feature}Service.remove(id, req.user.userNum);
  }
}
```

---

## Module 패턴

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([{Feature}])],
  controllers: [{Feature}Controller],
  providers: [{Feature}Service],
})
export class {Feature}Module {}
```

---

## 프론트 파일 패턴

```
app/(main)/{feature}/page.tsx          ← SC: import만 하고 CC 렌더
components/{feature}/{Feature}Client.tsx  ← CC: 'use client', 상태/API 담당
```

```tsx
// page.tsx (SC)
import {Feature}Client from '@/components/{feature}/{Feature}Client';
export default function {Feature}Page() {
  return <{Feature}Client />;
}

// {Feature}Client.tsx (CC)
'use client';
export default function {Feature}Client() {
  // nestApi 호출, useState, useEffect 등
}
```

---

## 체크리스트

새 CRUD 생성 후 반드시 확인:

- [ ] Entity nullable 컬럼에 `type` 명시
- [ ] Service `findOne`에 `relations: ['user']` 포함 (소유자 검사 시)
- [ ] Controller `ParseIntPipe` 적용
- [ ] `AppModule`의 `imports`에 새 Module 추가
- [ ] `ValidationPipe` 전역 설정으로 DTO 검증 자동 동작 확인
- [ ] 프론트 page.tsx는 SC (use client 없음)
- [ ] 빌드 & 린트 통과 확인
