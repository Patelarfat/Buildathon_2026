import os
import sys
import json
import shutil
import time
from datetime import datetime
import torch
import ultralytics
from ultralytics import YOLO

def main():
    print('==================================================')
    print('TRAINING CANDIDATE MODEL: YOLO26n on Construction-PPE')
    print('==================================================')
    
    device = '0' if torch.cuda.is_available() else 'cpu'
    if device == 'cpu':
        torch.set_num_threads(12)
        
    print(f'PyTorch Version: {torch.__version__}')
    print(f'Device: {device}')
    print(f'Ultralytics Version: {ultralytics.__version__}')
    
    dataset_name = 'construction-ppe.yaml'
    base_checkpoint = 'yolo26n.pt'
    
    ai_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(ai_dir, 'candidate_runs')
    weights_dir = os.path.join(ai_dir, 'candidate_weights')
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(weights_dir, exist_ok=True)
    
    epochs = 3
    imgsz = 640
    batch = 16
    workers = 0
    patience = 10
    
    print(f'Base Model: {base_checkpoint}')
    print(f'Target Dataset: {dataset_name}')
    print(f'Epochs: {epochs} | ImgSz: {imgsz} | Batch: {batch} | Device: {device}')
    
    model = YOLO(base_checkpoint)
    
    start_train_time = time.time()
    train_results = model.train(
        data=dataset_name,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        workers=workers,
        patience=patience,
        cache=True,
        project=output_dir,
        name='yolo26n_candidate',
        exist_ok=True,
        plots=False,
        save=True,
        verbose=True
    )
    
    duration = round(time.time() - start_train_time, 2)
    print(f'Training completed in {duration}s')
    
    best_weights = os.path.join(output_dir, 'yolo26n_candidate', 'weights', 'best.pt')
    if not os.path.exists(best_weights):
        best_weights = os.path.join(output_dir, 'yolo26n_candidate', 'weights', 'last.pt')
        
    cand_best = os.path.join(weights_dir, 'best.pt')
    if os.path.exists(best_weights):
        shutil.copy2(best_weights, cand_best)
        print(f'Saved candidate best weights to: {cand_best} ({os.path.getsize(cand_best)} bytes)')
        
    # Run validation on test split
    val_model = YOLO(cand_best if os.path.exists(cand_best) else best_weights)
    val_metrics = val_model.val(
        data=dataset_name,
        split='test',
        device=device,
        imgsz=imgsz,
        batch=batch,
        verbose=False
    )
    
    p = round(float(val_metrics.results_dict.get('metrics/precision(B)', 0.0)), 4)
    r = round(float(val_metrics.results_dict.get('metrics/recall(B)', 0.0)), 4)
    map50 = round(float(val_metrics.results_dict.get('metrics/mAP50(B)', 0.0)), 4)
    map50_95 = round(float(val_metrics.results_dict.get('metrics/mAP50-95(B)', 0.0)), 4)
    
    classes_dict = val_model.names if hasattr(val_model, 'names') else {}
    per_class_metrics = {}
    if hasattr(val_metrics, 'box') and hasattr(val_metrics.box, 'maps'):
        for idx, map_val in enumerate(val_metrics.box.maps):
            c_name = classes_dict.get(idx, str(idx))
            per_class_metrics[c_name] = round(float(map_val), 4)
            
    meta = {
        'model_name': 'yolo26n-candidate',
        'model_version': 'candidate-v1',
        'base_model': base_checkpoint,
        'ultralytics_version': ultralytics.__version__,
        'dataset_name': 'Construction-PPE (Ultralytics official)',
        'dataset_yaml': dataset_name,
        'classes': classes_dict,
        'trained_at': datetime.utcnow().isoformat() + 'Z',
        'training_device': device,
        'epochs': epochs,
        'image_size': imgsz,
        'batch_size': batch,
        'training_duration_seconds': duration,
        'metrics_test_split': {
            'precision': p,
            'recall': r,
            'mAP50': map50,
            'mAP50_95': map50_95,
            'per_class_mAP50_95': per_class_metrics
        }
    }
    
    meta_file = os.path.join(ai_dir, 'model_metadata_candidate.json')
    with open(meta_file, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    print(f'Saved candidate metadata to: {meta_file}')

if __name__ == '__main__':
    main()
