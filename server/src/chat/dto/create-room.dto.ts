import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @Length(1, 100)
  roomName!: string;

  @IsOptional()
  @IsInt()
  cityNum?: number;
}
