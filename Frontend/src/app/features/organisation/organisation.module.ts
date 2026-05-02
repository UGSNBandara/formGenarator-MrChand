import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ModernButtonComponent } from '../../shared/components/modern-button/modern-button.component';
import { ModernCardComponent } from '../../shared/components/modern-card/modern-card.component';
import { DomainCreateComponent } from './pages/org-create/domain-create.component';
import { DomainHomeComponent } from './pages/org-home/domain-home.component';
import { DomainUsersComponent } from './pages/org-members/domain-users.component';
import { DomainWorkflowRolesComponent } from './pages/workflow-roles/domain-workflow-roles.component';
import { AuthGuard } from '../../core/guards/auth.guard';

const routes: Routes = [
    { path: 'create', component: DomainCreateComponent, canActivate: [AuthGuard], data: { principalTypes: ['OWNER'] } },
    { path: ':slug', component: DomainHomeComponent },
    { path: ':slug/users', component: DomainUsersComponent, canActivate: [AuthGuard], data: { principalTypes: ['OWNER', 'DOMAIN_USER'] } },
    { path: ':slug/workflow-roles', component: DomainWorkflowRolesComponent, canActivate: [AuthGuard], data: { principalTypes: ['OWNER', 'DOMAIN_USER'] } },
];

@NgModule({
    declarations: [
        DomainCreateComponent,
        DomainUsersComponent,
        DomainWorkflowRolesComponent,
    ],
    imports: [
        SharedModule,
        RouterModule.forChild(routes),
        DomainHomeComponent,
        ModernCardComponent,
        ModernButtonComponent,
    ],
})
export class OrganisationModule { }
