// This entire dependency graph is reached only after choosing Game view.
import './world';
import './engine/bootstrap';
import { mountTransitions } from './engine/transitions';
mountTransitions();
