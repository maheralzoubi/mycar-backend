import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RateDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsString()
  review?: string;
}
