import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ThemeService } from '../../../../core/services/theme.service';

@Component({
  selector: 'app-workflow-explainer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow-explainer.component.html',
  styleUrls: ['./workflow-explainer.component.css']
})
export class WorkflowExplainerComponent implements OnInit {
  domainSlug = '';
  appSlug = '';
  dataShapeExample = `{
  "workflowDefinition": {
    "steps": [
      {
        "id": "step_1",
        "fields": [{ "key": "amount", "type": "NUMBER", "required": true }],
        "edges": [{ "id": "approve", "targetStepId": "step_2", "allowedRoles": ["App Admin"] }]
      }
    ]
  },
  "workflowInstance": {
    "currentStepId": "step_2",
    "stepRecords": {
      "step_1": { "amount": 1000, "requestor": "testabc123" }
    },
    "history": [
      { "stepId": "step_1", "edgeName": "approve", "performedBy": "testabc123" }
    ]
  }
}`;

  themeColor = '#1a1a2e';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    this.domainSlug = this.route.snapshot.params['slug'];
    this.appSlug = this.route.snapshot.params['appSlug'];
    this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
  }

  goBackToBuilder(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'workflows', 'builder']);
  }
}
