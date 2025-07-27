import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { Prisma } from '@prisma/client';

@Controller('candidates')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get()
  getAll() {
    return this.candidateService.getAll();
  }

  @Post()
  create(@Body() data: Prisma.CandidateCreateInput) {
    return this.candidateService.create(data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.candidateService.delete(id);
  }
}
