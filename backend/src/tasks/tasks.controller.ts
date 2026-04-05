import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private s: TasksService) {}

  @Get('feed')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Personalised task feed' })
  getFeed(@Request() req) { return this.s.getStudentFeed(req.user); }

  @Get('my')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Employer tasks' })
  getMyTasks(@Request() req) { return this.s.getEmployerTasks(req.user.walletAddress); }

  @Get(':id')
  @ApiOperation({ summary: 'Task details' })
  findOne(@Param('id') id: string) { return this.s.findOne(id); }

  @Post()
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Create task' })
  create(@Request() req, @Body() dto: any) { return this.s.createTask(req.user, dto); }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply to task' })
  apply(@Request() req, @Param('id') id: string) { return this.s.applyToTask(req.user, id); }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit work' })
  submit(@Request() req, @Param('id') id: string, @Body() body: { submissionHash: string }) {
    return this.s.submitTask(req.user, id, body.submissionHash);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm completion' })
  confirm(@Request() req, @Param('id') id: string) { return this.s.confirmTask(req.user, id); }
}
