import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('GET /api/health returns { status: "ok" }', () => {
    // No RULE-* ID — this is a bootstrap smoke test for the health endpoint
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
