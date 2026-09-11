import os
import sys
import json
import time
from pathlib import Path
from collections import Counter
from ultralytics import YOLO

CLASSES = {
    0: 'helmet',
    1: 'gloves',
    2: 'vest',
    3: 'boots',
    4: 'goggles',
    5: 'none',
    6: 'Person',
    7: 'no_helmet',
    8: 'no_goggle',
    9: 'no_gloves',
    10: 'no_boots'
}

VIOLATION_CLASSES = ['no_helmet', 'no_gloves', 'no_goggle', 'no_boots']
COMPLIANCE_CLASSES = ['helmet', 'gloves', 'vest', 'boots', 'goggles']

def run_evaluation(model_path: str, model_name: str, split: str = 'test', imgsz: int = 640):
    print(f'\n==================================================')
    print(f'EVALUATING: {model_name} on {split.upper()} split (imgsz={imgsz})')
    print(f'==================================================')
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f'Weights not found at: {model_path}')
        
    model = YOLO(model_path)
    
    metrics = model.val(
        data='construction-ppe.yaml',
        split=split,
        imgsz=imgsz,
        batch=16,
        device='cpu',
        verbose=False
    )
    
    rd = metrics.results_dict
    overall = {
        'precision': round(float(rd.get('metrics/precision(B)', 0.0)), 4),
        'recall': round(float(rd.get('metrics/recall(B)', 0.0)), 4),
        'map50': round(float(rd.get('metrics/mAP50(B)', 0.0)), 4),
        'map50_95': round(float(rd.get('metrics/mAP50-95(B)', 0.0)), 4),
    }
    
    speed = metrics.speed
    speed_dict = {
        'preprocess_ms': round(float(speed.get('preprocess', 0.0)), 2),
        'inference_ms': round(float(speed.get('inference', 0.0)), 2),
        'postprocess_ms': round(float(speed.get('postprocess', 0.0)), 2),
        'total_ms': round(float(speed.get('preprocess', 0.0) + speed.get('inference', 0.0) + speed.get('postprocess', 0.0)), 2)
    }
    
    per_class = {}
    if hasattr(metrics, 'box'):
        box = metrics.box
        p_per = box.p if hasattr(box, 'p') and box.p is not None else []
        r_per = box.r if hasattr(box, 'r') and box.r is not None else []
        map50_per = box.ap50 if hasattr(box, 'ap50') and box.ap50 is not None else []
        maps_per = box.maps if hasattr(box, 'maps') and box.maps is not None else []
        
        for idx in range(len(CLASSES)):
            c_name = CLASSES[idx]
            per_class[c_name] = {
                'precision': round(float(p_per[idx]), 4) if idx < len(p_per) else 0.0,
                'recall': round(float(r_per[idx]), 4) if idx < len(r_per) else 0.0,
                'map50': round(float(map50_per[idx]), 4) if idx < len(map50_per) else 0.0,
                'map50_95': round(float(maps_per[idx]), 4) if idx < len(maps_per) else 0.0,
            }
            
    return {
        'model_name': model_name,
        'model_path': model_path,
        'overall': overall,
        'speed': speed_dict,
        'per_class': per_class
    }

def test_on_ground_truth_images(model_path: str, conf_threshold: float = 0.25):
    model = YOLO(model_path)
    test_labels = list(Path('C:/Users/arfat/datasets/construction-ppe/labels/test').glob('*.txt'))
    test_images = list(Path('C:/Users/arfat/datasets/construction-ppe/images/test').glob('*.*'))
    img_map = {p.stem: p for p in test_images}
    
    gt_violation_counts = Counter()
    detected_violation_counts = Counter()
    detected_compliance_counts = Counter()
    total_images_with_violations = 0
    images_with_detected_violations = 0
    
    for lf in test_labels:
        if lf.stem not in img_map:
            continue
        img_path = str(img_map[lf.stem])
        
        # Read GT
        gt_classes = []
        with open(lf) as f:
            for line in f:
                p = line.strip().split()
                if p:
                    gt_classes.append(int(p[0]))
                    
        has_violation = any(c in [7, 8, 9, 10] for c in gt_classes)
        if has_violation:
            total_images_with_violations += 1
            for c in gt_classes:
                if c in [7, 8, 9, 10]:
                    gt_violation_counts[CLASSES[c]] += 1
                    
        # Predict at conf_threshold
        pred = model.predict(img_path, conf=conf_threshold, verbose=False)[0]
        pred_classes = [int(box.cls[0]) for box in pred.boxes]
        
        pred_has_violation = any(c in [7, 8, 9, 10] for c in pred_classes)
        if pred_has_violation:
            images_with_detected_violations += 1
            
        for c in pred_classes:
            c_name = CLASSES.get(c, str(c))
            if c_name in VIOLATION_CLASSES:
                detected_violation_counts[c_name] += 1
            elif c_name in COMPLIANCE_CLASSES:
                detected_compliance_counts[c_name] += 1
                
    return {
        'conf_threshold': conf_threshold,
        'total_images_with_violations': total_images_with_violations,
        'images_with_detected_violations': images_with_detected_violations,
        'gt_violation_counts': dict(gt_violation_counts),
        'detected_violation_counts': dict(detected_violation_counts),
        'detected_compliance_counts': dict(detected_compliance_counts)
    }

def main():
    baseline_path = 'C:/Users/arfat/Buldathon_ps1_2026/backend/ai/weights/best.pt'
    candidate_path = 'C:/Users/arfat/Buldathon_ps1_2026/backend/ai/candidate_weights/best.pt'
    
    if not os.path.exists(candidate_path):
        candidate_path = 'C:/Users/arfat/Buldathon_ps1_2026/backend/ai/candidate_runs/yolo26n_candidate/weights/best.pt'
    if not os.path.exists(candidate_path):
        candidate_path = 'yolo26n.pt' # fallback to pretrained checkpoint
        
    print('Starting Comparative Benchmark...')
    base_eval = run_evaluation(baseline_path, 'YOLO11n (Baseline)')
    cand_eval = run_evaluation(candidate_path, 'YOLO26n (Candidate)')
    
    print('\nRunning Application Inference (conf=0.25) on Non-Compliant Images...')
    base_infer = test_on_ground_truth_images(baseline_path, 0.25)
    cand_infer = test_on_ground_truth_images(candidate_path, 0.25)
    
    comparison = {
        'baseline': base_eval,
        'candidate': cand_eval,
        'application_inference_conf_0_25': {
            'baseline': base_infer,
            'candidate': cand_infer
        }
    }
    
    out_file = 'C:/Users/arfat/Buldathon_ps1_2026/backend/ai/benchmark_results.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(comparison, f, indent=2)
    print(f'\nSaved comparison results to: {out_file}')
    
if __name__ == '__main__':
    main()
