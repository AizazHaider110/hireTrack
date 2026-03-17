import { Test, TestingModule } from '@nestjs/testing';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

describe('PipelineController', () => {
  let controller: PipelineController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelineController],
      providers: [
        {
          provide: PipelineService,
          useValue: {
            createPipeline: jest.fn(),
            updatePipelineStages: jest.fn(),
            moveCandidateToStage: jest.fn(),
            bulkMoveCandidates: jest.fn(),
            getPipelineByJob: jest.fn(),
            getStageTransitionHistory: jest.fn(),
            getCandidateCard: jest.fn(),
            updateCandidateCardPosition: jest.fn(),
            addCandidateToPipeline: jest.fn(),
            removeCandidateFromPipeline: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PipelineController>(PipelineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
