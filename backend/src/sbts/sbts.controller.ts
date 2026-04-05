import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SbtsService } from './sbts.service';

@ApiTags('sbts')
@Controller('sbts')
export class SbtsController {
  constructor(private sbtsService: SbtsService) {}

  @Get('student/:wallet')
  @ApiOperation({ summary: 'Get student SBTs' })
  getStudentSbts(@Param('wallet') wallet: string) { return this.sbtsService.getStudentSbts(wallet); }

  @Get('student/:wallet/tags')
  @ApiOperation({ summary: 'Get student skill tags' })
  getTags(@Param('wallet') wallet: string) { return this.sbtsService.getStudentTags(wallet); }
}
