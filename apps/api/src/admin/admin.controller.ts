import { Controller, Get, Param, Query } from '@nestjs/common';
import { AdminScoreEntry, Paginated, PlayerDetailDto } from '@ox/shared';
import { Roles } from '../auth/roles.decorator';
import { AdminScoresQueryDto } from './dto/admin-scores-query.dto';
import { AdminService } from './admin.service';

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** AUTH-06: lists all players with scores; paginated + sortable. */
  @Get('scores')
  getScores(@Query() query: AdminScoresQueryDto): Promise<Paginated<AdminScoreEntry>> {
    return this.admin.getScores(query.page, query.pageSize, query.sort);
  }

  /** AUTH-06: returns score + last 10 games for a specific player. */
  @Get('players/:id')
  getPlayerDetail(@Param('id') id: string): Promise<PlayerDetailDto> {
    return this.admin.getPlayerDetail(id);
  }
}
