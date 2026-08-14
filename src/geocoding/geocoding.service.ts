import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly config: ConfigService) {}

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const baseUrl = this.config.get<string>('geocodeBaseUrl');
    try {
      const { data } = await axios.get(`${baseUrl}/reverse`, {
        params: { format: 'json', lat, lon: lng },
        headers: { 'User-Agent': 'my-car-backend/0.1 (roadside assistance)' },
      });
      return data?.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
      this.logger.warn(`Reverse geocode failed: ${(err as Error).message}`);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }
}
