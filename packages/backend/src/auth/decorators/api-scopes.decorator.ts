import { SetMetadata } from '@nestjs/common';
import { API_KEY_SCOPES } from '../guards/api-key.guard';

export const ApiScopes = (...scopes: string[]) =>
  SetMetadata(API_KEY_SCOPES, scopes);
