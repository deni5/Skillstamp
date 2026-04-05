import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SbtsService } from './sbts.service';
import { SbtsController } from './sbts.controller';
import { Sbt } from './sbt.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sbt, User])],
  providers: [SbtsService],
  controllers: [SbtsController],
  exports: [SbtsService],
})
export class SbtsModule {}
