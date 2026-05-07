import { IsNumber, IsString, Length, Max, Min } from 'class-validator';

export class CreateCityDto {
  @IsString()
  @Length(1, 50)
  cityName: string;

  @IsString()
  @Length(1, 50)
  country: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
